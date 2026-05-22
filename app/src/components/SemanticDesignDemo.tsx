import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Layers, Monitor, ShieldCheck, Clock, LayoutGrid, BookOpen, List } from "lucide-react";

/* ── Prompt cycle: section variant demos ── */
const PROMPTS = [
  {
    text: "Experience as timeline",
    semantic: [
      { label: "action", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "timeline" },
    ],
    variant: "timeline" as const,
    desc: "Left border with dot markers. Each entry connects visually along a vertical axis.",
  },
  {
    text: "Experience as cards",
    semantic: [
      { label: "action", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "cards" },
    ],
    variant: "cards" as const,
    desc: "Boxed grid layout. Each entry is a self-contained card with border and background.",
  },
  {
    text: "Experience as editorial flow",
    semantic: [
      { label: "action", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "editorial-flow" },
    ],
    variant: "editorial" as const,
    desc: "Magazine-style with accent bars. Each entry has a colored left border accent.",
  },
  {
    text: "Experience as default",
    semantic: [
      { label: "action", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "default" },
    ],
    variant: "default" as const,
    desc: "Standard list view. Clean, minimal entry layout with heading and bullets.",
  },
];

/* ── Timing ── */
const TYPING_SPEED = 55;
const DELETE_SPEED = 28;
const PAUSE_AFTER_TYPE = 400;
const PAUSE_AFTER_PIPELINE = 1800;
const PAUSE_AFTER_DELETE = 500;
const PIPELINE_STEP_MS = [150, 800, 1600, 2600];
const SHOW_SEMANTIC_MS = 1600;
const SHOW_CSS_MS = 2600;

/* ── Pipeline steps ── */
const PIPELINE_STEPS = [
  { id: 0, label: "Intent Parser", icon: <Brain className="w-5 h-5" />, desc: 'Parses "experience as timeline" → set_section_variant' },
  { id: 1, label: "Section Router", icon: <Layers className="w-5 h-5" />, desc: "Routes to the section variant renderer for experience" },
  { id: 2, label: "Variant Engine", icon: <Monitor className="w-5 h-5" />, desc: "Renders with cv-timeline CSS classes and dot markers" },
  { id: 3, label: "Live Preview", icon: <BookOpen className="w-5 h-5" />, desc: "Experience section re-renders in timeline view" },
];

/* ── Mini-CV data ── */
const MINI_CV = {
  name: "Alex Chen",
  title: "Senior Software Engineer",
  experience: [
    { heading: "TechCorp Inc.", sub: "Senior Engineer", date: "2021 - Present", bullets: ["Led microservices migration", "Reduced latency by 40%"] },
    { heading: "StartupXYZ", sub: "Full-Stack Developer", date: "2018 - 2021", bullets: ["Built CI/CD pipeline", "Scaled to 1M users"] },
  ],
};

type Phase = "typing" | "pipeline" | "deleting" | "switching";

type VariantType = "timeline" | "cards" | "editorial" | "default";

/** Render the Experience section in the given variant */
function ExperiencePreview({ variant }: { variant: VariantType }) {
  const entries = MINI_CV.experience;

  if (variant === "timeline") {
    return (
      <div className="cv-timeline space-y-4 relative pl-6">
        {/* Timeline vertical line */}
        <div className="absolute left-[9px] top-0 bottom-0 w-0.5 bg-cyan-400/30 rounded-full" />
        {entries.map((e, i) => (
          <div key={i} className="cv-timeline-entry relative">
            {/* Dot marker */}
            <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-white shadow-sm" />
            <div className="cv-timeline-content bg-white/40 rounded-lg p-3 border border-cyan-500/10">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-slate-800">{e.heading}</span>
                <span className="text-[10px] text-cyan-600 font-mono">{e.date}</span>
              </div>
              <div className="text-[10px] text-slate-500 mb-1.5">{e.sub}</div>
              <ul className="space-y-1">
                {e.bullets.map((b, j) => (
                  <li key={j} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                    <span className="text-cyan-400 mt-0.5 flex-shrink-0">▸</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="cv-entry-grid grid grid-cols-2 gap-3">
        {entries.map((e, i) => (
          <div key={i} className="cv-entry--card bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs text-slate-800">{e.heading}</span>
            </div>
            <div className="text-[10px] text-slate-500 mb-0.5">{e.sub}</div>
            <div className="text-[10px] text-cyan-600 font-mono mb-2">{e.date}</div>
            <ul className="space-y-1">
              {e.bullets.map((b, j) => (
                <li key={j} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                  <span className="text-cyan-400 mt-0.5 flex-shrink-0">▸</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "editorial") {
    return (
      <div className="space-y-3">
        {entries.map((e, i) => (
          <div key={i} className="cv-entry--editorial flex gap-3 bg-white/40 rounded-lg overflow-hidden border border-slate-200/50">
            {/* Accent bar */}
            <div className="cv-entry-accent-bar w-1 bg-gradient-to-b from-cyan-400 to-purple-400 flex-shrink-0" />
            <div className="cv-entry-content py-3 pr-3 flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-slate-800">{e.heading}</span>
                <span className="text-[10px] text-cyan-600 font-mono">{e.date}</span>
              </div>
              <div className="text-[10px] text-slate-500 mb-1.5">{e.sub}</div>
              <ul className="space-y-1">
                {e.bullets.map((b, j) => (
                  <li key={j} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                    <span className="text-cyan-400 mt-0.5 flex-shrink-0">▸</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // default
  return (
    <div className="space-y-4">
      {entries.map((e, i) => (
        <div key={i} className="cv-entry">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-semibold text-xs text-slate-800">{e.heading}</span>
            <span className="text-[10px] text-cyan-600 font-mono">{e.date}</span>
          </div>
          <div className="text-[10px] text-slate-500 mb-1.5">{e.sub}</div>
          <ul className="space-y-1">
            {e.bullets.map((b, j) => (
              <li key={j} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                <span className="text-cyan-400 mt-0.5 flex-shrink-0">▸</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function SemanticDesignDemo() {
  const [promptIndex, setPromptIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [activeStep, setActiveStep] = useState(-1);
  const [showSemantic, setShowSemantic] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const currentPrompt = PROMPTS[promptIndex];
  const fullText = currentPrompt.text;

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (isPaused) return;
    clearAllTimers();

    const t: ReturnType<typeof setTimeout>[] = [];

    switch (phase) {
      case "typing": {
        if (displayText.length < fullText.length) {
          const timer = setTimeout(() => {
            setDisplayText(fullText.slice(0, displayText.length + 1));
          }, TYPING_SPEED);
          t.push(timer);
        } else {
          const timer = setTimeout(() => {
            setPhase("pipeline");
          }, PAUSE_AFTER_TYPE);
          t.push(timer);
        }
        break;
      }

      case "pipeline": {
        const t0 = setTimeout(() => setActiveStep(0), PIPELINE_STEP_MS[0]);
        const t1 = setTimeout(() => setActiveStep(1), PIPELINE_STEP_MS[1]);
        const t2 = setTimeout(() => { setActiveStep(2); setShowSemantic(true); }, SHOW_SEMANTIC_MS);
        const t3 = setTimeout(() => { setActiveStep(3); setShowPreview(true); }, SHOW_CSS_MS);
        t.push(t0, t1, t2, t3);

        const t4 = setTimeout(() => {
          setPhase("deleting");
        }, SHOW_CSS_MS + PAUSE_AFTER_PIPELINE);
        t.push(t4);
        break;
      }

      case "deleting": {
        if (displayText.length > 0) {
          const timer = setTimeout(() => {
            setDisplayText((prev) => prev.slice(0, -1));
          }, DELETE_SPEED);
          t.push(timer);
        } else {
          setActiveStep(-1);
          setShowSemantic(false);
          setShowPreview(false);
          const timer = setTimeout(() => {
            setPromptIndex((prev) => (prev + 1) % PROMPTS.length);
            setPhase("typing");
          }, PAUSE_AFTER_DELETE);
          t.push(timer);
        }
        break;
      }

      case "switching": {
        const timer = setTimeout(() => {
          setPromptIndex((prev) => (prev + 1) % PROMPTS.length);
          setPhase("typing");
        }, PAUSE_AFTER_DELETE);
        t.push(timer);
        break;
      }
    }

    timersRef.current = t;
    return () => { clearAllTimers(); };
  }, [phase, displayText, promptIndex, fullText, isPaused, clearAllTimers]);

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);

  const variantIcons: Record<VariantType, React.ReactNode> = {
    timeline: <Clock className="w-4 h-4 text-cyan-500" />,
    cards: <LayoutGrid className="w-4 h-4 text-purple-500" />,
    editorial: <BookOpen className="w-4 h-4 text-amber-500" />,
    default: <List className="w-4 h-4 text-slate-500" />,
  };

  return (
    <div className="space-y-8" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* ── SECURITY BADGE ── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 text-xs font-medium">
            The LLM never writes CSS — it only sets section variants
          </span>
        </div>
      </div>

      {/* ── LIVE INTENT TYPING BOX ── */}
      <div className="flex justify-center">
        <div
          className="relative w-full max-w-xl rounded-2xl border px-8 py-6 text-center"
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(6, 182, 212, 0.25)",
            boxShadow: "0 0 40px rgba(6, 182, 212, 0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div className="text-xs text-cyan-400/60 font-mono mb-3 tracking-widest uppercase">
            User Intent
          </div>
          <div className="text-lg sm:text-xl text-white font-light min-h-[2rem] flex items-center justify-center">
            <span className="font-medium" style={{ color: "var(--cv-accent, #3b82f6)" }}>
              {displayText}
            </span>
            <span
              className={`inline-block w-[2px] h-5 ml-1 ${phase === "typing" && displayText.length === fullText.length ? "opacity-0" : "animate-cursor-blink"}`}
              style={{ backgroundColor: "var(--cv-accent, #3b82f6)" }}
            />
          </div>
          {/* Variant label */}
          {phase !== "typing" && (
            <div className="mt-3 flex items-center justify-center gap-2 animate-fade-in">
              <span className="text-xs text-slate-500 font-mono">→ renders as</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                {variantIcons[currentPrompt.variant]}
                {currentPrompt.variant}
              </span>
            </div>
          )}
          <div className="mt-3 flex justify-center gap-1.5">
            {PROMPTS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === promptIndex ? "bg-cyan-400 scale-125" : "bg-slate-600"}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── ARCHITECTURAL PIPELINE + LIVE PREVIEW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 tracking-widest uppercase mb-4">
            Variant Pipeline
          </h3>
          {PIPELINE_STEPS.map((step, idx) => (
            <div
              key={step.id}
              className={`relative rounded-xl border p-4 transition-all duration-500 ${
                activeStep >= idx
                  ? "border-cyan-500/30 bg-slate-800/60"
                  : "border-slate-700/20 bg-slate-800/30 opacity-50"
              }`}
            >
              {activeStep === idx && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-cyan-400 animate-pulse" />
              )}

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-500 ${
                    activeStep >= idx ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-700/30 text-slate-500"
                  }`}
                >
                  {step.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${activeStep >= idx ? "text-white" : "text-slate-500"}`}>
                      {step.label}
                    </span>
                    <span className="text-xs font-mono text-slate-500">Step {idx + 1}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
                </div>
              </div>

              {/* Semantic action display */}
              {activeStep >= idx && idx === 1 && showSemantic && (
                <div className="mt-3 pt-3 border-t border-cyan-500/10 animate-fade-in">
                  <div className="grid grid-cols-1 gap-2">
                    {currentPrompt.semantic.map((s, i) => (
                      <div
                        key={s.label}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-cyan-500/10 animate-slide-right"
                        style={{ animationDelay: `${i * 100}ms` }}
                      >
                        <span className="text-xs text-cyan-400/70 font-mono">{s.label}:</span>
                        <span className="text-xs text-white font-medium">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Variant description */}
              {activeStep >= idx && idx === 2 && showPreview && (
                <div className="mt-3 pt-3 border-t border-cyan-500/10 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    {variantIcons[currentPrompt.variant]}
                    <span>{currentPrompt.desc}</span>
                  </div>
                </div>
              )}

              {/* Preview updated notice */}
              {activeStep >= idx && idx === 3 && showPreview && (
                <div className="mt-3 pt-3 border-t border-cyan-500/10 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Experience section re-rendered in {currentPrompt.variant} view</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Live Preview */}
        <div>
          <h3 className="text-sm font-semibold text-slate-300 tracking-widest uppercase mb-4">
            Live Preview — Experience Section
          </h3>
          <div
            className="rounded-xl border overflow-hidden transition-all duration-700 bg-white p-5"
            style={{ borderColor: "#e5e7eb" }}
          >
            {/* Header */}
            <div className="mb-4 pb-3 border-b-2 border-slate-800">
              <h4 className="font-bold text-lg text-slate-800">{MINI_CV.name}</h4>
              <p className="text-sm text-slate-500">{MINI_CV.title}</p>
            </div>

            {/* Experience section with variant */}
            <div className="cv-section">
              <h5 className="font-semibold text-xs uppercase tracking-wider mb-3 text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                {variantIcons[currentPrompt.variant]}
                Experience
                <span className="ml-auto text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  variant: {currentPrompt.variant}
                </span>
              </h5>
              <ExperiencePreview variant={currentPrompt.variant} />
            </div>
          </div>
          <div className="mt-3 text-center">
            <span className="text-xs text-slate-500 font-mono">
              Works for any section: experience, education, awards, certifications, publications, projects, volunteers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
