import { useEffect, useState } from "react";
import {
  Search, Brain, PenTool, Palette,
  CheckCircle, ArrowRight, Wand2, RotateCcw,
} from "lucide-react";

interface NodeData {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const PIPELINE_NODES: NodeData[] = [
  { id: "fetcher", label: "FETCHER", icon: <Search className="w-5 h-5" />, color: "#06b6d4", description: "Extracts profile from PDF or URL" },
  { id: "analyst", label: "ANALYST", icon: <Brain className="w-5 h-5" />, color: "#a855f7", description: "Compares profile vs job advert" },
  { id: "writer", label: "WRITER", icon: <PenTool className="w-5 h-5" />, color: "#ec4899", description: "Writes optimized CV content" },
  { id: "designer", label: "DESIGNER", icon: <Palette className="w-5 h-5" />, color: "#f59e0b", description: "Applies DesignComposition and renders deterministic HTML/PDF" },
];

const REFINE_NODES: NodeData[] = [
  { id: "writer-r", label: "WRITER", icon: <PenTool className="w-4 h-4" />, color: "#ec4899", description: "Applies content changes" },
  { id: "designer-r", label: "DESIGNER", icon: <Palette className="w-4 h-4" />, color: "#f59e0b", description: "Applies semantic design changes and re-renders" },
];

function AgentNode({
  node,
  size = "normal",
  isActive,
  onEnter,
  onLeave,
}: {
  node: NodeData;
  size?: "normal" | "small";
  isActive: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const isSmall = size === "small";
  return (
    <div
      className="relative flex flex-col items-center cursor-pointer group"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        className={`flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-300 ${isSmall ? "w-[72px] h-[64px]" : "w-[88px] h-[88px]"}`}
        style={{
          background: isActive ? `${node.color}15` : "rgba(15,23,42,0.6)",
          borderColor: isActive ? node.color : `${node.color}40`,
          boxShadow: isActive ? `0 0 24px 6px ${node.color}40` : "none",
        }}
      >
        <div style={{ color: node.color }}>{node.icon}</div>
        <span className={`font-bold uppercase tracking-wider ${isSmall ? "text-[8px]" : "text-[9px]"}`} style={{ color: node.color }}>
          {node.label}
        </span>
      </div>
      {isActive && (
        <div className="absolute top-full mt-2 z-20">
          <div className="bg-slate-800 text-slate-300 text-[10px] px-3 py-1.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap">
            {node.description}
          </div>
        </div>
      )}
    </div>
  );
}

function ArrowConnector({ color = "#64748b" }: { color?: string }) {
  return (
    <div className="flex items-center px-1">
      <div className="w-8 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, ${color}60, ${color}30)` }} />
      <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: `${color}90`, marginLeft: -2 }} />
    </div>
  );
}

export default function WorkflowAnimation() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setPhase((p) => (p + 1) % 6), 900);
    return () => clearInterval(interval);
  }, []);

  const isPulsing = (index: number) => phase === index;

  return (
    <div className="w-full py-6 select-none">
      {/* ── INITIAL PIPELINE ── */}
      <div className="mb-8">
        <div className="text-center mb-6">
          <h3 className="text-base font-bold text-white mb-1">Initial Pipeline</h3>
          <p className="text-xs text-slate-400">4 agents process your CV sequentially</p>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-y-6">
          {PIPELINE_NODES.map((node, i) => (
            <div key={node.id} className="flex items-center">
              <div className="transition-transform duration-300" style={{ animation: isPulsing(i) ? "nodePulse 1s ease-in-out" : "none" }}>
                <AgentNode node={node} isActive={activeNode === node.id} onEnter={() => setActiveNode(node.id)} onLeave={() => setActiveNode(null)} />
              </div>
              {i < PIPELINE_NODES.length - 1 && <ArrowConnector color={node.color} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── REVIEW GATEWAY ── */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Review</span>
            <p className="text-[10px] text-emerald-400/70 mt-0.5">Preview PDF + Markdown</p>
          </div>
        </div>
      </div>

      {/* ── REFINEMENT LOOP ── */}
      <div>
        <div className="text-center mb-6">
          <h3 className="text-sm font-bold text-white mb-1 flex items-center justify-center gap-2">
            <Wand2 className="w-4 h-4 text-purple-400" />
            Refine Loop
          </h3>
          <p className="text-xs text-slate-400">Repeatable — Writer edits text, Designer renders</p>
        </div>
        <div className="flex items-center justify-center flex-wrap gap-y-6">
          {REFINE_NODES.map((node, i) => (
            <div key={node.id} className="flex items-center">
              <div className="transition-transform duration-300" style={{ animation: isPulsing(i + 4) ? "nodePulse 1s ease-in-out" : "none" }}>
                <AgentNode node={node} size="small" isActive={activeNode === node.id} onEnter={() => setActiveNode(node.id)} onLeave={() => setActiveNode(null)} />
              </div>
              {i < REFINE_NODES.length - 1 && <ArrowConnector color={node.color} />}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 text-slate-500 mt-3">
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400/60" />
          <span className="text-[10px] text-emerald-400/60 font-medium uppercase tracking-wider">Loop until satisfied</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <div className="text-[10px] text-slate-500">Designer output</div>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <div className="text-[10px] text-emerald-400/70">new preview</div>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <div className="text-[10px] text-slate-500">user reviews</div>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <div className="text-[10px] text-purple-400/70">refine again?</div>
        </div>
      </div>

      {/* ── DONE ── */}
      <div className="flex items-center justify-center mt-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Done</span>
          <span className="text-[10px] text-emerald-400/60">— click &quot;I&apos;m so satisfied&quot;</span>
        </div>
      </div>

      <style>{`
        @keyframes nodePulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.08); filter: brightness(1.3); }
        }
      `}</style>
    </div>
  );
}
