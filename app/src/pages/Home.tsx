import { useState, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Sparkles, Zap, FileText, Globe, Briefcase, Loader2, AlertTriangle, Info, Server, ServerOff, BookOpen, RotateCcw,
} from "lucide-react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import PdfUploader from "@/components/PdfUploader";
import UrlInput from "@/components/UrlInput";
import JobAdvertInput from "@/components/JobAdvertInput";
import CvUpdatesInput from "@/components/CvUpdatesInput";
import AgentProgress from "@/components/AgentProgress";
import ResultsDisplay from "@/components/ResultsDisplay";
import RefinementPanel from "@/components/RefinementPanel";
import { setActiveJob, getActiveJob, clearActiveJob, hasActiveJob } from "@/lib/sessionMemory";
import logo from "./logo.png";

type InputMode = "pdf" | "url";

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>("pdf");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [jobAdvert, setJobAdvert] = useState("");
  const [updates, setUpdates] = useState("");
  const [jobId, setJobId] = useState<number | null>(getActiveJob());
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasInitialResult, setHasInitialResult] = useState(hasActiveJob());
  const [refinementVersion, setRefinementVersion] = useState(0);
  const [fetcherOutput, setFetcherOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [restoredJob, setRestoredJob] = useState(false);

  const createJob = trpc.cv.createJob.useMutation();
  const uploadPdf = trpc.cv.uploadPdf.useMutation();
  const processJob = trpc.cv.processJob.useMutation();
  const ollamaStatus = trpc.cv.checkOllama.useQuery(undefined, { refetchInterval: 15000 });

  const effectiveJobId = jobId;

  // Poll as long as the job is in a non-terminal state.
  // DON'T tie polling to isRunning — that creates a chicken-and-egg
  // where polling stops before the final status update arrives.
  const getJob = trpc.cv.getJob.useQuery(
    { jobId: effectiveJobId! },
    {
      enabled: !!effectiveJobId,
      refetchInterval: (query) => {
        const s = (query.state.data as { status?: string } | undefined)?.status;
        const terminal = s === "completed" || s === "error" || s === "awaiting_review";
        return !terminal ? 1500 : false;
      },
      refetchIntervalInBackground: true,
    }
  );

  // On mount: reattach to active job from session memory
  useEffect(() => {
    const memJobId = getActiveJob();
    if (memJobId && !restoredJob) {
      setJobId(memJobId);
      setHasInitialResult(true);
      setRestoredJob(true);
      // Fetch current status immediately
      getJob.refetch();
    }
  }, [restoredJob]);

  // Sync status from API
  useEffect(() => {
    if (getJob.data) {
      const status = getJob.data.status;
      setStatusText(status);

      if (status === "completed") {
        setIsRunning(false);
        setIsComplete(true);
        setHasInitialResult(true);
        if (refinementVersion > 0) setRefinementVersion((v) => v + 1);
      } else if (status === "error") {
        setIsRunning(false);
        setError(getJob.data.errorMessage || "An error occurred");
        clearActiveJob();
      } else if (status === "refining") {
        setIsRunning(true);
        setIsComplete(false);
        setHasInitialResult(true);
      } else if (status === "awaiting_review") {
        setIsRunning(false);
        setIsComplete(false);
        setHasInitialResult(true);
      } else if (["fetching", "analyzing", "writing", "designing"].includes(status)) {
        setIsRunning(true);
        setIsComplete(false);
        setHasInitialResult(true);
      }
      if (getJob.data.fetcherOutput) setFetcherOutput(getJob.data.fetcherOutput);
    }
  }, [getJob.data]);

  // Animated dots for loading
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isRunning]);

  const handleFileSelect = useCallback((file: File) => { setPdfFile(file); setInputMode("pdf"); setError(null); }, []);
  const handleClearPdf = useCallback(() => { setPdfFile(null); }, []);

  const handleGenerate = async () => {
    if (!jobAdvert.trim()) { setError("Please enter a job advertisement"); return; }
    if (inputMode === "pdf" && !pdfFile) { setError("Please upload a PDF CV"); return; }
    if (inputMode === "url" && !url.trim()) { setError("Please enter a website URL"); return; }

    setError(null); setIsRunning(true); setIsComplete(false); setHasInitialResult(false);
    setFetcherOutput(null); setRefinementVersion(0);

    try {
      const job = await createJob.mutateAsync({
        inputType: inputMode,
        sourceUrl: inputMode === "url" ? url : undefined,
        jobAdvert: jobAdvert.trim(),
        updates: updates.trim() || undefined,
      });

      setJobId(job.id);
      setActiveJob(job.id);
      if (inputMode === "pdf" && pdfFile) {
        const base64 = await fileToBase64(pdfFile);
        await uploadPdf.mutateAsync({ jobId: job.id, pdfBase64: base64 });
      }
      await processJob.mutateAsync({ jobId: job.id, jobAdvert: jobAdvert.trim() });
    } catch (err) {
      setIsRunning(false);
      setError(err instanceof Error ? err.message : "Failed to start generation");
      clearActiveJob();
    }
  };


  const refine = trpc.cv.refine.useMutation();
  const satisfy = trpc.cv.satisfied.useMutation();
  const utils = trpc.useUtils();
  const restoreBackup = trpc.cv.restoreBackup.useMutation();

  const handleRefine = useCallback((writerInstruction: string, designerInstruction: string, editedMarkdown: string | null) => {
    if (!effectiveJobId) return;
    setIsRunning(true);
    setIsComplete(false);
    refine.mutate({
      jobId: effectiveJobId,
      writerInstruction: writerInstruction.trim(),
      designerInstruction: designerInstruction.trim(),
      editedMarkdown: editedMarkdown || undefined,
    }, {
      onSuccess: () => {
        // Don't set isRunning=false here — the mutation returns immediately
        // but the backend refinement is async. Let the getJob polling manage isRunning.
        // Just trigger a refetch so the UI picks up the "refining" status quickly.
        setRefinementVersion((v) => v + 1);
        getJob.refetch();
      },
      onError: (err) => {
        setError(err.message);
        setIsRunning(false);
      },
    });
  }, [effectiveJobId, refine, getJob]);

  const handleRestore = useCallback(() => {
    if (!effectiveJobId) return;
    restoreBackup.mutate({ jobId: effectiveJobId }, {
      onSuccess: async () => {
        if (effectiveJobId) {
          await utils.cv.getMarkdown.invalidate({ jobId: effectiveJobId });
          await utils.cv.getHtml.invalidate({ jobId: effectiveJobId });
          await utils.cv.getJob.invalidate({ jobId: effectiveJobId });
        }

        setRefinementVersion((v) => v + 1);
        getJob.refetch();

        setError("Previous CV restored successfully.");
        setTimeout(() => setError(null), 4000);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  }, [effectiveJobId, restoreBackup, getJob]);

  const handleSatisfied = useCallback(() => {
    setShowConfetti(true);
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) { clearInterval(interval); setShowConfetti(false); return; }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // Call backend to finalize pipeline, print report, and release VRAM
    if (effectiveJobId) {
      satisfy.mutate({ jobId: effectiveJobId });
    }
    // Immediately stop the spinner — the backend will set status to "completed"
    // and the useEffect below will confirm it when the query refreshes
    setIsRunning(false);
    setIsComplete(true);
    setStatusText("completed");
    // Keep jobId active for 8s so user sees the 100% completion bar, then fade out
    setTimeout(() => clearActiveJob(), 8000);
  }, [effectiveJobId, satisfy]);

  const canGenerate = jobAdvert.trim().length > 0 && (inputMode === "pdf" ? !!pdfFile : url.trim().length > 0);

  // Determine visibility
  const isRefining = statusText?.toLowerCase().includes("refin");
  const isAwaitingReview = statusText === "awaiting_review";

  // During main pipeline (fetching/analyzing/writing/designing) OR refinement:
  // Show the animated "Your optimized CV..." loading card
  const showLoadingCv = isRunning && hasInitialResult;

  // Show actual CV results only when pipeline is NOT running
  // (i.e., awaiting_review or completed)
  const showCvResults = hasInitialResult && !isRunning;

  // Show refinement panel when initial result exists and we're in review/refine state
  const showRefinement = hasInitialResult && (isAwaitingReview || isRefining || isComplete);

  // Fetch current markdown for the Write Text tab (must be declared AFTER showRefinement)
  const { data: markdownData } = trpc.cv.getMarkdown.useQuery(
    { jobId: effectiveJobId! },
    { enabled: !!effectiveJobId && showRefinement }
  );
  const currentMarkdown = markdownData?.markdown || "";

  // Show restored banner if we reattached
  const showRestoredBanner = restoredJob && hasActiveJob() && !isComplete && !isRefining;

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white relative">
      {showConfetti && <div className="fixed inset-0 pointer-events-none z-[9999]" />}

      <div className="relative z-10">
        <header className="border-b border-cyan-500/10 backdrop-blur-sm bg-[#0a0a1a]/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.35)]">
              <img
                src={logo}
                className="w-full h-full object-cover scale-125"
                alt="logo"
              />
            </div>

            <div>
                <h1 className="text-lg font-bold neon-text tracking-tight">CV Optimizer AI</h1>
                <p className="text-xs text-slate-400">AI-Powered CV Tailoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`hidden sm:flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg border ${ollamaStatus.data?.available ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
                {ollamaStatus.data?.available ? <><Server className="w-3 h-3" /> qwen3 Ready</> : <><ServerOff className="w-3 h-3" /> qwen3 Offline</>}
              </div>
              <Link to="/how-it-works" className="hidden sm:flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-300 transition-colors">
                <Info className="w-3.5 h-3.5" /> How It Works
              </Link>
              <Link to="/github-docs" className="hidden sm:flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-300 transition-colors">
                <BookOpen className="w-3.5 h-3.5" /> GitHub Docs
              </Link>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Hero */}
          <div className="text-center mb-10 animate-slide-up">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              <span className="neon-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">Optimize Your CV</span>
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Enter your profile, add updates, paste the job advert, and let 4 AI agents craft your perfect CV. Edit until you're satisfied.
            </p>
            {ollamaStatus.data && !ollamaStatus.data.available && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                <ServerOff className="w-3.5 h-3.5" />
                qwen3 offline. Using rule-based engine.
                <code className="bg-slate-800 px-2 py-0.5 rounded text-amber-300">ollama pull qwen3</code>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3 animate-slide-up">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Restored session banner */}
          {showRestoredBanner && (
            <div className="mb-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3 animate-slide-up">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin flex-shrink-0" />
              <p className="text-cyan-300 text-sm">
                Reconnected to your running pipeline! Status: <strong>{statusText}</strong>. You can continue browsing — the pipeline runs in the background.
              </p>
            </div>
          )}

          {/* ── INPUT AREA ── */}
          {!hasInitialResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              <div className="lg:col-span-3 space-y-6">
                <div className="animate-slide-up-delay-1">
                  <div className="glass-panel rounded-xl p-5">
                    <div className="flex rounded-lg bg-slate-800/50 p-1 mb-5">
                      <button onClick={() => setInputMode("pdf")} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${inputMode === "pdf" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                        <FileText className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button onClick={() => setInputMode("url")} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-all ${inputMode === "url" ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                        <Globe className="w-3.5 h-3.5" /> URL
                      </button>
                    </div>
                    {inputMode === "pdf" ? (
                      <PdfUploader onFileSelect={handleFileSelect} selectedFile={pdfFile} onClear={handleClearPdf} />
                    ) : (
                      <UrlInput url={url} onUrlChange={setUrl} fetcherOutput={fetcherOutput} isFetching={isRunning && getJob.data?.currentAgent === "FETCHER"} />
                    )}
                  </div>
                </div>

                <div className="animate-slide-up-delay-2">
                  <div className="glass-panel rounded-xl p-5" style={{ minHeight: "200px" }}>
                    <CvUpdatesInput value={updates} onChange={setUpdates} />
                  </div>
                </div>

                <div className="hidden lg:block animate-slide-up-delay-2">
                  <div className="glass-panel rounded-xl p-5">
                    <h3 className="text-cyan-400 text-xs font-semibold mb-3 uppercase tracking-wider">How It Works</h3>
                    <div className="space-y-3">
                      {[
                        { icon: <FileText className="w-3.5 h-3.5" />, text: "Upload CV or enter profile URL" },
                        { icon: <Sparkles className="w-3.5 h-3.5" />, text: "Add updates (new certifications, roles)" },
                        { icon: <Briefcase className="w-3.5 h-3.5" />, text: "Paste the job advertisement" },
                        { icon: <Zap className="w-3.5 h-3.5" />, text: "4 AI agents: Fetcher, Analyst, Writer, Designer" },
                        { icon: <RotateCcw className="w-3.5 h-3.5" />, text: "Semantic design engine — refine with natural language" },
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center flex-shrink-0 text-cyan-400 mt-0.5">{step.icon}</div>
                          <p className="text-slate-400 text-xs leading-relaxed">{step.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 animate-slide-up-delay-2">
                <div className="glass-panel rounded-xl p-5 h-full min-h-[450px] flex flex-col">
                  <JobAdvertInput value={jobAdvert} onChange={setJobAdvert} />
                </div>
              </div>

              <div className="lg:col-span-4 animate-slide-up-delay-3">
                <div className="glass-panel rounded-xl p-5">
                  <button onClick={handleGenerate} disabled={!canGenerate || isRunning}
                    className={`cyber-btn w-full flex items-center justify-center gap-2 py-4 text-base ${!canGenerate ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {isRunning ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5" /> Generate the best CV</>}
                  </button>
                  {!canGenerate && (
                    <p className="text-slate-500 text-xs text-center mt-3">
                      {!jobAdvert.trim() ? "Enter a job advertisement to continue" : inputMode === "pdf" ? "Upload a PDF CV to continue" : "Enter a profile URL to continue"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PROGRESS & RESULTS ── */}
          {hasInitialResult && effectiveJobId && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5">
                <div className="glass-panel rounded-xl p-5 mb-6">
                  <AgentProgress jobId={effectiveJobId} isRunning={isRunning} isComplete={isComplete} />
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                {showLoadingCv && (
                  <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-4 animate-slide-up">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    <h3 className="text-cyan-400 text-lg font-semibold neon-text">
                      Your optimized CV{dots}
                    </h3>
                    <p className="text-slate-400 text-xs text-center max-w-sm">
                      {isRefining
                        ? "The Writer and Designer agents are refining your CV. This may take a moment."
                        : "The Fetcher, Analyst, Writer, and Designer agents are crafting your CV with semantic design. This may take a moment."}
                    </p>
                  </div>
                )}

                {showCvResults && (
                  <ResultsDisplay jobId={effectiveJobId} isComplete={isComplete || isAwaitingReview} refinementVersion={refinementVersion} onRestore={handleRestore} />
                )}

                {showRefinement && (
                  <RefinementPanel
                    onRefine={handleRefine}
                    onSatisfied={handleSatisfied}
                    disabled={isRunning}
                    awaitingReview={isAwaitingReview}
                    currentMarkdown={currentMarkdown}
                  />
                )}
              </div>
            </div>
          )}
        </main>

        <footer className="border-t border-cyan-500/10 mt-12 backdrop-blur-sm bg-[#0a0a1a]/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <p className="text-slate-500 text-xs">CV Optimizer AI - Semantic Document Design Engine - Local & Free</p>
            <div className="flex items-center gap-4">
              {["FETCHER", "ANALYST", "WRITER", "DESIGNER"].map((a, i) => (
                <span key={a} className="flex items-center gap-1"><span className="text-xs text-slate-600">{a}</span>{i < 3 && <span className="text-slate-700 ml-2">|</span>}</span>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const result = reader.result as string; resolve(result.split(",")[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
