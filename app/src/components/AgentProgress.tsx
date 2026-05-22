import { useEffect, useState } from "react";
import {
  Search, Brain, PenTool, Palette, CheckCircle2, AlertCircle, Loader2,
  Clock, Lightbulb, TrendingUp, TrendingDown, MessageSquare,
  ChevronDown, ChevronUp, Sparkles, Wand2, ThumbsUp, Shirt, Code,
} from "lucide-react";

interface AgentStep {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const AGENT_STEPS: AgentStep[] = [
  { id: "FETCHER", name: "FETCHER", icon: <Search className="w-5 h-5" />, description: "Extracting profile + updates" },
  { id: "ANALYST", name: "ANALYST", icon: <Brain className="w-5 h-5" />, description: "Analyzing job vs profile" },
  { id: "WRITER", name: "WRITER", icon: <PenTool className="w-5 h-5" />, description: "Writing optimized CV" },
  { id: "DESIGNER", name: "DESIGNER", icon: <Palette className="w-5 h-5" />, description: "Designing layout + PDF" },
];

interface StrategyData {
  shortcomings: string[];
  strengths: string[];
  interviewTips: string[];
  emphasis: string[];
  tone: string;
  removedSkills: string[];
  removedExperience: number;
  qualificationsKept?: number;
  culturalItemsKept?: number;
}

interface ProgressState {
  status: string;
  currentAgent: string | null;
  agentMessage: string;
  fetcherOutput?: string;
  error?: string;
  strategyData?: StrategyData;
}

interface AgentProgressProps {
  jobId: number | null;
  isRunning: boolean;
  isComplete?: boolean;
}

export default function AgentProgress({ jobId, isRunning, isComplete }: AgentProgressProps) {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [strategyExpanded, setStrategyExpanded] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`/api/progress/${jobId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressState;
        setProgress(data);

        const statusMap: Record<string, number> = {
          fetching: 15, analyzing: 40, writing: 65, designing: 85,
          awaiting_review: 92, refining: 95, completed: 100, error: 0,
        };
        setOverallProgress(statusMap[data.status] || 0);

        if (data.status === "completed" || data.status === "error") {
          setTimeout(() => eventSource.close(), 3000);
        }
      } catch { /* ignore */ }
    };

    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  }, [jobId]);

  const getStepStatus = (stepId: string) => {
    if (!progress) return "pending";

    if (progress.status === "error") {
      const agentOrder = ["FETCHER", "ANALYST", "WRITER", "DESIGNER"];
      const failedIdx = agentOrder.indexOf(progress.currentAgent || "");
      const stepIdx = agentOrder.indexOf(stepId);
      if (stepIdx < failedIdx) return "completed";
      if (stepIdx === failedIdx) return "error";
      return "pending";
    }

    if (["fetching", "analyzing", "writing", "designing"].includes(progress.status)) {
      const agentOrder = ["FETCHER", "ANALYST", "WRITER", "DESIGNER"];
      const currentIdx = agentOrder.indexOf(progress.currentAgent || "");
      const stepIdx = agentOrder.indexOf(stepId);
      if (stepIdx < currentIdx) return "completed";
      if (stepIdx === currentIdx) return "active";
      return "pending";
    }

    // All 4 agents done
    const agentOrder = ["FETCHER", "ANALYST", "WRITER", "DESIGNER"];
    const stepIdx = agentOrder.indexOf(stepId);
    if (stepIdx >= 0) return "completed";
    return "pending";
  };

  const isFullyComplete = progress?.status === "completed" || !!isComplete;
  function isRefiningStatus(status?: string): boolean {
    return (status ?? "").toLowerCase().includes("refin");
  }
  const isRefining = isRefiningStatus(progress?.status);
  const isAwaitingReview = progress?.status === "awaiting_review";
  const hasStrategyData = !!progress?.strategyData;
  const fourAgentsDone = isAwaitingReview || isRefining || isFullyComplete;

  // Normalized currentAgent for safe matching
  const currentAgent = (progress?.currentAgent ?? "").toUpperCase();

  // Helpers for matching refine-phase agent names like "WRITER_REFINE", "DESIGNER_REFINE"
  function isWriterAgent(agent?: string | null): boolean {
    return !!agent && agent.toUpperCase().includes("WRITER");
  }
  function isDesignerAgent(agent?: string | null): boolean {
    return !!agent && agent.toUpperCase().includes("DESIGNER");
  }

  // Refinement sub-step status: WRITER -> DESIGNER
  const getRefinementWriterStatus = () => {
    if (!progress) return "pending";
    if (isFullyComplete) return "completed";
    if (isRefining && isWriterAgent(currentAgent)) return "active";
    if (isRefining && isDesignerAgent(currentAgent)) return "completed";
    if (isRefining && !isWriterAgent(currentAgent) && !isDesignerAgent(currentAgent)) return "completed";
    return "pending";
  };

  const getRefinementDesignerStatus = () => {
    if (!progress) return "pending";
    if (isFullyComplete) return "completed";
    if (isRefining && isDesignerAgent(currentAgent)) return "active";
    if (isRefining && !isWriterAgent(currentAgent) && !isDesignerAgent(currentAgent)) return "completed";
    return "pending";
  };

  return (
    <div className="w-full animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 text-sm font-semibold flex items-center gap-2 neon-text">
          {(isRunning || isRefining) && !isFullyComplete ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isFullyComplete ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
          Agent Pipeline Status
        </h3>
        <span className="text-xs font-mono text-slate-400">{Math.round(isFullyComplete ? 100 : overallProgress)}%</span>
      </div>

      <div className="progress-bar mb-4">
        <div className="progress-bar-fill" style={{
          width: `${isFullyComplete ? 100 : overallProgress}%`,
          background: isFullyComplete ? "linear-gradient(90deg, #22c55e, #4ade80)"
            : fourAgentsDone ? "linear-gradient(90deg, #8b5cf6, #a78bfa)"
            : "linear-gradient(90deg, #06b6d4, #22d3ee, #67e8f9)",
        }} />
      </div>

      {progress?.agentMessage && (
        <p className={`text-xs mb-4 ${progress.status === "error" ? "text-red-400" : isFullyComplete ? "text-green-400" : "text-cyan-300/70"}`}>
          {progress.agentMessage}
        </p>
      )}

      {/* 4 main agent steps */}
      <div className="space-y-2">
        {AGENT_STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          return (
            <div key={step.id}
              className={`agent-card flex items-center gap-3 ${status === "active" ? "active" : ""} ${status === "completed" ? "completed" : ""} ${status === "error" ? "error" : ""}`}
              style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  status === "active" ? "bg-cyan-500/20 text-cyan-400"
                  : status === "completed" ? "bg-green-500/20 text-green-400"
                  : status === "error" ? "bg-red-500/20 text-red-400"
                  : "bg-slate-700/30 text-slate-500"
                }`}>
                  {status === "completed" ? <CheckCircle2 className="w-5 h-5" />
                    : status === "error" ? <AlertCircle className="w-5 h-5" />
                    : step.icon}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${
                    status === "active" ? "text-cyan-400"
                    : status === "completed" ? "text-green-400"
                    : status === "error" ? "text-red-400"
                    : "text-slate-400"
                  }`}>{step.name}</span>
                  {status === "active" && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
                </div>
                <p className="text-xs text-slate-400 truncate">{step.description}</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{index + 1}/4</span>
            </div>
          );
        })}

        {/* ── Refinement step with WRITER + DESIGNER sub-steps ── */}
        <div className={`agent-card flex flex-col gap-2 ${fourAgentsDone ? "completed" : "pending"}`}>
          {/* Main refinement row */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isFullyComplete ? "bg-green-500/20 text-green-400"
                : fourAgentsDone ? "bg-purple-500/20 text-purple-400"
                : "bg-slate-700/30 text-slate-500"
              }`}>
                {isFullyComplete ? <ThumbsUp className="w-5 h-5" />
                  : isRefining ? <Loader2 className="w-5 h-5 animate-spin" />
                  : isAwaitingReview ? <Wand2 className="w-5 h-5 text-purple-400" />
                  : <Sparkles className="w-5 h-5" />}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${
                  isFullyComplete ? "text-green-400"
                  : fourAgentsDone ? "text-purple-400"
                  : "text-slate-400"
                }`}>REFINEMENT</span>
                {isRefining && <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />}
                {isAwaitingReview && !isRefining && <span className="w-2 h-2 rounded-full bg-purple-400" />}
              </div>
              <p className="text-xs text-slate-400 truncate">
                {isFullyComplete ? "User satisfied — pipeline complete"
                  : isRefining ? "Applying refinements..."
                  : isAwaitingReview ? "Refinement open — review your CV"
                  : "Will start after design"}
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">5/5</span>
          </div>

          {/* Sub-steps: Writer → Stylist → Designer PRO */}
          {fourAgentsDone && (
            <div className="ml-11 pl-4 border-l border-purple-500/20 space-y-1.5 mt-1">
              {/* Writer sub-step */}
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                  getRefinementWriterStatus() === "completed" ? "bg-green-500/20 text-green-400"
                  : getRefinementWriterStatus() === "active" ? "bg-pink-500/20 text-pink-400"
                  : "bg-slate-700/30 text-slate-500"
                }`}>
                  {getRefinementWriterStatus() === "completed" ? <CheckCircle2 className="w-3 h-3" />
                    : getRefinementWriterStatus() === "active" ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <PenTool className="w-3 h-3" />}
                </div>
                <span className={`text-xs ${
                  getRefinementWriterStatus() === "completed" ? "text-green-400"
                  : getRefinementWriterStatus() === "active" ? "text-pink-400"
                  : "text-slate-500"
                }`}>Writer</span>
              </div>

              {/* Designer sub-step */}
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${
                  getRefinementDesignerStatus() === "completed" ? "bg-green-500/20 text-green-400"
                  : getRefinementDesignerStatus() === "active" ? "bg-amber-500/20 text-amber-400"
                  : "bg-slate-700/30 text-slate-500"
                }`}>
                  {getRefinementDesignerStatus() === "completed" ? <CheckCircle2 className="w-3 h-3" />
                    : getRefinementDesignerStatus() === "active" ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Palette className="w-3 h-3" />}
                </div>
                <span className={`text-xs ${
                  getRefinementDesignerStatus() === "completed" ? "text-green-400"
                  : getRefinementDesignerStatus() === "active" ? "text-amber-400"
                  : "text-slate-500"
                }`}>Designer</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Pro & contro — Tips and tricks ── */}
      {hasStrategyData && (
        <div className="mt-5 glass-panel rounded-xl p-4 border-amber-500/30 animate-slide-up">
          <button onClick={() => setStrategyExpanded(!strategyExpanded)} className="w-full flex items-center justify-between">
            <h4 className="text-amber-400 text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Pro &amp; contro — Tips and tricks
            </h4>
            {strategyExpanded ? <ChevronUp className="w-4 h-4 text-amber-400/60" /> : <ChevronDown className="w-4 h-4 text-amber-400/60" />}
          </button>

          {strategyExpanded && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                {((progress.strategyData?.qualificationsKept ?? 0) > 0) && (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">{progress.strategyData?.qualificationsKept} qualifications kept</span>
                )}
                {((progress.strategyData?.culturalItemsKept ?? 0) > 0) && (
                  <span className="text-[10px] px-2 py-1 rounded-md bg-pink-500/10 text-pink-400 border border-pink-500/20">{progress.strategyData?.culturalItemsKept} cultural items kept</span>
                )}
              </div>

              {(progress.strategyData?.shortcomings?.length ?? 0) > 0 && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <h5 className="text-red-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Areas to Improve</h5>
                  <ul className="space-y-1">{(progress.strategyData?.shortcomings ?? []).map((item, i) => (<li key={i} className="text-red-300/80 text-[11px] leading-relaxed flex items-start gap-2"><span className="text-red-500/50 mt-0.5">-</span>{item}</li>))}</ul>
                </div>
              )}

              {(progress.strategyData?.strengths?.length ?? 0) > 0 && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <h5 className="text-green-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Reinforce Your Strengths</h5>
                  <ul className="space-y-1">{(progress.strategyData?.strengths ?? []).map((item, i) => (<li key={i} className="text-green-300/80 text-[11px] leading-relaxed flex items-start gap-2"><span className="text-green-500/50 mt-0.5">-</span>{item}</li>))}</ul>
                </div>
              )}

              {(progress.strategyData?.interviewTips?.length ?? 0) > 0 && (
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <h5 className="text-purple-400 text-xs font-semibold mb-2 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Interview Tips</h5>
                  <ul className="space-y-1">{(progress.strategyData?.interviewTips ?? []).map((item, i) => (<li key={i} className="text-purple-300/80 text-[11px] leading-relaxed flex items-start gap-2"><span className="text-purple-500/50 mt-0.5">-</span>{item}</li>))}</ul>
                </div>
              )}

              {(progress.strategyData?.emphasis?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(progress.strategyData?.emphasis ?? []).map((e) => (<span key={e} className="text-[10px] px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">{e}</span>))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {progress?.status === "error" && progress?.error && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-red-400 text-xs">{progress.error}</p>
        </div>
      )}

      {isFullyComplete && (
        <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
          <p className="text-green-400 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Pipeline complete! Your optimized CV is finalized.
          </p>
        </div>
      )}
    </div>
  );
}
