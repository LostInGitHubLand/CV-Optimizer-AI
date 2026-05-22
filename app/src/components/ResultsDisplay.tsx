import { useState, useEffect } from "react";
import { FileText, Download, Eye, Code, CheckCircle2, Loader2, AlertTriangle, Sparkles, RotateCcw } from "lucide-react";
import { marked } from "marked";
import { trpc } from "@/providers/trpc";

interface ResultsDisplayProps {
  jobId: number | null;
  isComplete: boolean;
  refinementVersion?: number;
  onRestore?: () => void;
}

export default function ResultsDisplay({ jobId, isComplete, refinementVersion = 0, onRestore }: ResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "markdown">("preview");
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showRefinementNotice, setShowRefinementNotice] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // Query job data to check if backup exists
  const jobQuery = trpc.cv.getJob.useQuery(
    { jobId: jobId! },
    { enabled: !!jobId, refetchInterval: false }
  );
  const hasBackup =
    !!jobQuery.data?.hasBackup ||
    !!jobQuery.data?.backupHtml ||
    !!jobQuery.data?.backupMarkdown ||
    !!jobQuery.data?.backupDesignComposition;

  // Use tRPC React Query hooks with polling until data is available
  const markdownQuery = trpc.cv.getMarkdown.useQuery(
    { jobId: jobId! },
    { 
      enabled: !!jobId,
      refetchInterval: dataReady ? false : 2000,
      retry: 10,
    }
  );

  const htmlQuery = trpc.cv.getHtml.useQuery(
    { jobId: jobId! },
    { 
      enabled: !!jobId,
      refetchInterval: dataReady ? false : 2000,
      retry: 10,
    }
  );

  const markdown = markdownQuery.data?.markdown ?? "";
  const html = htmlQuery.data?.html ?? "";
  const isLoading = markdownQuery.isLoading || htmlQuery.isLoading;

  // Track when both data sources are ready
  useEffect(() => {
    if (html && markdown) {
      setDataReady(true);
    }
  }, [html, markdown]);

  // Re-fetch when refinement completes
  useEffect(() => {
    if (refinementVersion > 0 && jobId) {
      setDataReady(false);
      markdownQuery.refetch();
      htmlQuery.refetch();
      setShowRefinementNotice(true);
      const timer = setTimeout(() => setShowRefinementNotice(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [refinementVersion, jobId]);

  // Convert markdown to HTML for fallback display whenever markdown changes
  useEffect(() => {
    if (markdown) {
      const parsed = marked.parse(markdown) as string;
      setHtmlContent(parsed);
    }
  }, [markdown]);

  // Direct download via Hono route
  const handleDownloadPdf = () => {
    if (!jobId) return;
    setDownloadError(null);
    const url = `/api/download/pdf/${jobId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `optimized-cv-${jobId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      fetch(url, { method: "HEAD" })
        .then((r) => {
          if (!r.ok) {
            setDownloadError("PDF not ready yet. Please wait a moment and try again.");
          }
        })
        .catch(() => {
          setDownloadError("Download failed. The PDF may not be ready yet.");
        });
    }, 1000);
  };

  const handleDownloadMarkdown = () => {
    if (!jobId) return;
    setDownloadError(null);
    const url = `/api/download/md/${jobId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `optimized-cv-${jobId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Loading state: show three dots animation while waiting for agent output
  const [dots, setDots] = useState("");
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [isLoading]);

  if (isLoading && !html && !markdown) {
    return (
      <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-cyan-400 text-sm font-medium">Loading CV preview{dots}</p>
        <p className="text-slate-500 text-xs">Fetching rendered CV from the Designer agent...</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-green-400 text-sm font-semibold flex items-center gap-2 neon-text">
          <CheckCircle2 className="w-4 h-4" />
          Your Optimized CV
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("preview")}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${activeTab === "preview"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              }
            `}
          >
            <Eye className="w-3.5 h-3.5" />
            PDF Preview
          </button>
          <button
            onClick={() => setActiveTab("markdown")}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
              ${activeTab === "markdown"
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              }
            `}
          >
            <Code className="w-3.5 h-3.5" />
            Markdown
          </button>
        </div>
      </div>

      {/* Download buttons */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={handleDownloadPdf}
          className="cyber-btn cyber-btn-pink flex items-center gap-2 text-xs py-2 px-4"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </button>
        <button
          onClick={handleDownloadMarkdown}
          className="cyber-btn flex items-center gap-2 text-xs py-2 px-4"
        >
          <FileText className="w-3.5 h-3.5" />
          Download Markdown
        </button>
        {hasBackup && onRestore && (
          <button
            onClick={onRestore}
            className="flex items-center gap-2 text-xs py-2 px-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Previous CV
          </button>
        )}
      </div>

      {/* Download error */}
      {downloadError && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs">{downloadError}</p>
        </div>
      )}

      {/* Refinement complete notice */}
      {showRefinementNotice && (
        <div className="mb-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-2 animate-slide-up">
          <Sparkles className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-green-300 text-xs font-medium">Your CV has been updated after refinement!</p>
            <p className="text-green-400/70 text-[10px] mt-0.5">Download your updated files using the buttons above.</p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="glass-panel rounded-xl overflow-hidden">
        {activeTab === "preview" ? (
          html ? (
            <iframe
              srcDoc={html}
              className="w-full min-h-[600px] bg-white border-0"
              title="CV Preview"
            />
          ) : (
            <div className="p-8 flex flex-col items-center justify-center gap-3 min-h-[300px]">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-cyan-400 text-sm">Rendering HTML/CSS preview{dots}</p>
              <p className="text-slate-500 text-xs">Waiting for Designer agent output...</p>
            </div>
          )
        ) : (
          <pre className="p-6 text-xs text-cyan-200/80 font-mono overflow-auto max-h-[600px] whitespace-pre-wrap break-words">
            {markdown || "No markdown available yet..."}
          </pre>
        )}
      </div>
    </div>
  );
}
