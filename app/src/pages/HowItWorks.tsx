import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, Brain, Palette,
  Search, PenTool, Sparkles, Shield,
  Lock, Eye, Ban, ArrowRight, Layers,
  Cpu, ShieldCheck, Monitor,
} from "lucide-react";
import WorkflowAnimation from "@/components/WorkflowAnimation";
import SemanticDesignDemo from "@/components/SemanticDesignDemo";

const AGENTS = [
  { name: "FETCHER", role: "Profile Extractor", icon: <Search className="w-6 h-6" />, color: "from-cyan-500 to-cyan-600", shadowColor: "shadow-cyan-500/30", borderColor: "border-cyan-500/40", desc: "Reads your PDF CV or website and turns it into structured data. Detects whether you work in Tech, Legal, Medical, or Creative fields. Also merges any new qualifications you added.", tools: ["PDF Parsing", "Web Scraping", "Domain Detection", "CV Update Merging"], model: "qwen3" },
  { name: "ANALYST", role: "Data Curator", icon: <Brain className="w-6 h-6" />, color: "from-purple-500 to-purple-600", shadowColor: "shadow-purple-500/30", borderColor: "border-purple-500/40", desc: "Compares your profile to the job advert and decides the best way to present your experience. It rearranges sections, highlights your most relevant achievements, and suggests better professional vocabulary — but never makes up fake numbers or achievements.", tools: ["Hierarchy Shifting", "Semantic Highlighting", "Qualitative Detailing", "Rule-Based Fallback"], model: "qwen3" },
  { name: "WRITER", role: "Content Refiner", icon: <PenTool className="w-6 h-6" />, color: "from-pink-500 to-pink-600", shadowColor: "shadow-pink-500/30", borderColor: "border-pink-500/40", desc: "Rewrites your bullet points with stronger action verbs and clearer language. Rewrites your summary to target the job. Strictly limited: it can only add 1 extra sentence (under 20 words) per entry, and can never invent metrics. After each run, it triggers VRAM unload to free GPU memory.", tools: ["Action Verbs", "Metric Freeze", "Expansion Limit", "Terminology Alignment", "VRAM Unload"], model: "qwen3" },
  { name: "DESIGNER", role: "Semantic Design Engine", icon: <Palette className="w-6 h-6" />, color: "from-amber-500 to-orange-500", shadowColor: "shadow-amber-500/30", borderColor: "border-amber-500/40", desc: "Converts your visual intent into semantic design actions — set_theme, set_layout, set_section_variant — then applies them to the DesignComposition. The renderer produces deterministic HTML from the resolved composition. The Designer never writes CSS, HTML, or inline styles. It only manipulates layout, theme, and visual variants.", tools: ["Semantic Action Parser", "3 Layouts", "11 Themes", "Section Variants", "VRAM Unload"], model: "qwen3" },
];

const SECTION_VARIANT_DEMOS = [
  {
    text: "Experience as timeline",
    semantic: [
      { label: "type", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "timeline" },
    ],
    preview: "timeline",
  },
  {
    text: "Experience as cards",
    semantic: [
      { label: "type", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "cards" },
    ],
    preview: "cards",
  },
  {
    text: "Experience as editorial flow",
    semantic: [
      { label: "type", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "editorial-flow" },
    ],
    preview: "editorial",
  },
  {
    text: "Experience as default",
    semantic: [
      { label: "type", value: "set_section_variant" },
      { label: "section", value: "experience" },
      { label: "variant", value: "default" },
    ],
    preview: "default",
  },
];

export default function HowItWorks() {
  const [activeSection, setActiveSection] = useState<"animation" | "semantic" | "agents" | "security">("animation");
  const [hoveredAgent, setHoveredAgent] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <header className="border-b border-cyan-500/10 backdrop-blur-sm bg-[#0a0a1a]/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to CV Optimizer
          </Link>
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span className="text-sm font-semibold neon-text">CV Optimizer AI</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-16 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-xs font-medium">100% Free — Zero Cloud Costs — Runs on Your Computer</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="neon-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">How It Works</span>
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            CV Optimizer AI runs entirely on your computer — no cloud accounts, no API keys, no subscription fees.
            Your CV data never leaves your machine. Enter your profile, add updates, paste the job advert,
            and let 4 specialized AI agents craft your perfect CV through a structured pipeline.
            The only cost is the electricity to run your computer.
          </p>
        </div>

        <div className="flex justify-center mb-12">
          <div className="flex rounded-xl bg-slate-800/50 p-1.5 border border-slate-700/50">
            {(["animation", "semantic", "agents", "security"] as const).map((section) => (
              <button key={section} onClick={() => setActiveSection(section)}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 capitalize ${activeSection === section ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"}`}>
                {section === "animation" ? "Pipeline" : section}
              </button>
            ))}
          </div>
        </div>

        {/* ANIMATED PIPELINE */}
        {activeSection === "animation" && (
          <section className="animate-slide-up">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Pipeline Visualization</h2>
              <p className="text-slate-400 text-sm">Hover over each node to see what it does</p>
            </div>
            <div className="glass-panel rounded-2xl p-8 border-slate-700/30 bg-slate-800/20">
              <WorkflowAnimation />
            </div>
          </section>
        )}

        {/* SEMANTIC DESIGN DEMO */}
        {activeSection === "semantic" && (
          <section className="animate-slide-up space-y-8">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-3">
                <Layers className="w-6 h-6 text-purple-400" />
                Section Visual Variants
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl mx-auto">
                Change how any section looks with natural language. Each section supports 4 visual variants:
                Timeline (left border with dot markers), Cards (boxed grid entries), Editorial Flow (magazine-style accent bars), and Default (standard list).
                The LLM parses your intent into set_section_variant actions — never touching CSS directly.
              </p>
            </div>
            <div className="glass-panel rounded-2xl p-6 sm:p-8 border-purple-500/10 bg-slate-800/20">
              <SemanticDesignDemo />
            </div>

            {/* ── ALL THEMES ── */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Palette className="w-5 h-5 text-amber-400" />
                All 11 Themes
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[
                  { id: "minimal-swiss", name: "Minimal Swiss", desc: "Whitespace, Helvetica, flat hierarchy", tag: "Light", color: "bg-slate-100" },
                  { id: "modern-editorial", name: "Modern Editorial", desc: "Magazine layout, serif headings, accent bars", tag: "Light", color: "bg-rose-50" },
                  { id: "elegant-premium", name: "Elegant Premium", desc: "Luxurious spacing, gold + navy, serif", tag: "Light", color: "bg-amber-50" },
                  { id: "brutalist", name: "Brutalist", desc: "Raw structure, bold type, strong borders", tag: "Neutral", color: "bg-gray-100" },
                  { id: "technical-dark", name: "Technical Dark", desc: "Terminal aesthetic, monospace, high contrast", tag: "Dark", color: "bg-gray-800" },
                  { id: "neon-cyberpunk", name: "Neon Cyberpunk", desc: "Neon glow, deep black, electric accents", tag: "Dark", color: "bg-slate-900" },
                  { id: "glassmorphism", name: "Glassmorphism", desc: "Frosted glass, soft gradients, transparency", tag: "Light", color: "bg-indigo-50" },
                  { id: "monochrome-corporate", name: "Monochrome Corporate", desc: "Strict grayscale, dense, professional", tag: "Light", color: "bg-gray-50" },
                  { id: "luxury-serif", name: "Luxury Serif", desc: "Dramatic serif, warm tones, executive", tag: "Light", color: "bg-orange-50" },
                  { id: "clean-startup", name: "Clean Startup", desc: "Energetic, bold accent, modern sans-serif", tag: "Light", color: "bg-violet-50" },
                  { id: "dark-academic", name: "Dark Academic", desc: "Scholarly dark, warm neutrals, academic", tag: "Dark", color: "bg-slate-800" },
                ].map((theme) => (
                  <div key={theme.id} className="glass-panel rounded-lg p-3 border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-3 h-3 rounded-full ${theme.color} border border-slate-400/30`} />
                      <span className="text-sm text-slate-200 font-medium truncate">{theme.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{theme.desc}</p>
                    <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ${theme.tag === "Dark" ? "bg-slate-700 text-slate-300" : theme.tag === "Neutral" ? "bg-gray-700 text-gray-300" : "bg-slate-700/50 text-slate-400"}`}>{theme.tag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ALL LAYOUTS ── */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                All 3 Layouts
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "single-column", name: "Single Column", desc: "Top-to-bottom vertical flow. No sidebar. Safest fallback for all domains.", sections: "All sections in main flow" },
                  { id: "sidebar-left", name: "Sidebar Left", desc: "Sidebar (35%) on LEFT for contacts, skills, languages. Main on right.", sections: "Tech, DevOps, Data Science, Creative" },
                  { id: "sidebar-right", name: "Sidebar Right", desc: "Main on LEFT, sidebar (35%) on RIGHT for skills, certs, languages.", sections: "Legal, Medical, Healthcare" },
                ].map((layout) => (
                  <div key={layout.id} className="glass-panel rounded-lg p-4 border-slate-700/30">
                    <h4 className="text-sm font-semibold text-white mb-1">{layout.name}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">{layout.desc}</p>
                    <p className="text-[10px] text-cyan-400/70 font-mono">{layout.sections}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── SECTION VISUAL VARIANTS ── */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Monitor className="w-5 h-5 text-purple-400" />
                Section Visual Variants
              </h3>
              <div className="space-y-3">
                {/* Entry-based sections */}
                {[
                  { section: "Experience", variants: "default, cards, timeline, editorial-flow", desc: "Work history entries with 4 visual styles" },
                  { section: "Education", variants: "default, cards, timeline, editorial-flow", desc: "Academic background with grade support" },
                  { section: "Certifications", variants: "default, cards, timeline, editorial-flow", desc: "Professional certificates and licenses" },
                  { section: "Awards", variants: "default, cards, timeline, editorial-flow", desc: "Honors, prizes, recognitions" },
                  { section: "Publications", variants: "default, cards, timeline, editorial-flow", desc: "Papers, articles, research output" },
                  { section: "Projects", variants: "default, cards, timeline, editorial-flow", desc: "Personal or professional projects" },
                  { section: "Volunteers", variants: "default, cards, timeline, editorial-flow", desc: "Volunteering and community work" },
                  { section: "Skills", variants: "grouped-pills, compact-tags, terminal-stack, visual-matrix, expertise-bars, floating-cards, accent-pills, accent-pills-flat", desc: "Skill groups with 8 item-level styles" },
                  { section: "Languages", variants: "default, proficiency-bars, proficiency-list", desc: "Language proficiencies with bar or text level" },
                ].map((row) => (
                  <div key={row.section} className="flex items-start gap-4 glass-panel rounded-lg p-3 border-slate-700/30">
                    <span className="text-sm font-semibold text-white w-36 flex-shrink-0">{row.section}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {row.variants.split(", ").map((v) => (
                          <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">{v}</span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400">{row.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture explanation cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              <div className="glass-panel rounded-xl p-5 border-purple-500/10">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-purple-400" />
                  <h4 className="text-sm font-semibold text-white">LLM Intent</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The LLM parses natural language into semantic actions — set_theme, set_layout,
                  set_section_variant, move_section. It never outputs CSS, hex codes, pixel values,
                  or font names. Only intent, never implementation.
                </p>
              </div>
              <div className="glass-panel rounded-xl p-5 border-cyan-500/10">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  <h4 className="text-sm font-semibold text-white">Resolution Engine</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  3-layer pipeline: Layout (single-column, sidebar-left, sidebar-right) →
                  Theme (11 visual identities) → Semantic State (tone, density, emphasis) →
                  Normalization (conflict resolution + per-section variant routing).
                </p>
              </div>
              <div className="glass-panel rounded-xl p-5 border-emerald-500/10">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-semibold text-white">Deterministic Render</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Layout + Theme + Semantic State + Section Variants → semantic HTML with CSS
                  variables. Section variants (timeline, cards, editorial-flow) render independently
                  per section type. Same intent always produces the same output.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* AGENTS */}
        {activeSection === "agents" && (
          <section className="animate-slide-up">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">The Four Agents</h2>
              <p className="text-slate-400 text-sm max-w-2xl mx-auto">4 specialized AI agents working in sequence through a structured JSON pipeline. Each has a specific job — just like a real editorial team.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {AGENTS.map((agent, idx) => (
                <div key={agent.name}
                  className={`relative overflow-hidden rounded-xl border p-6 transition-all duration-500 cursor-pointer ${hoveredAgent === idx ? `${agent.shadowColor} ${agent.borderColor} scale-[1.02]` : "border-slate-700/30"} bg-slate-800/40 backdrop-blur-sm`}
                  onMouseEnter={() => setHoveredAgent(idx)} onMouseLeave={() => setHoveredAgent(null)}>
                  <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${agent.color} transition-opacity duration-500 ${hoveredAgent === idx ? "opacity-40" : "opacity-10"}`} />
                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-white shadow-lg`}>{agent.icon}</div>
                      <div>
                        <h3 className="text-lg font-bold text-white">{agent.name}</h3>
                        <p className="text-xs text-slate-400">{agent.role}</p>
                        <p className="text-xs text-slate-500 font-mono">{agent.model}</p>
                      </div>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed mb-4">{agent.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {agent.tools.map((tool) => <span key={tool} className="text-xs px-2.5 py-1 rounded-md bg-slate-700/50 text-slate-300 border border-slate-600/30">{tool}</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Structure-First explanation card */}
            <div className="mt-8 glass-panel rounded-xl p-6 border-cyan-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Structure-First: What It Means for You</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-3">
                    Most AI CV builders act like ghostwriters — they invent metrics, add fake achievements, and creatively rewrite your career. This system is different.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/20">
                      <p className="text-red-400 text-xs font-semibold mb-1">Traditional AI does this:</p>
                      <p className="text-slate-400 text-xs">"Led a team of 12 developers and increased revenue by 25%" — <em>even if you never mentioned team size or revenue</em></p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/50 border border-cyan-500/20">
                      <p className="text-cyan-400 text-xs font-semibold mb-1">This system does this:</p>
                      <p className="text-slate-400 text-xs">"Led development team and significantly improved product performance" — <em>using only what you actually said, with stronger verbs</em></p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECURITY */}
        {activeSection === "security" && (
          <section className="animate-slide-up">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Security & Constraints</h2>
              <p className="text-slate-400 text-sm">How we protect your data and prevent manipulation — explained simply</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="glass-panel rounded-xl p-6 border-red-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0"><Ban className="w-6 h-6 text-red-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Prompt Injection Protection</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">If someone tries to trick the AI by writing "ignore all previous instructions" inside their CV or job advert, the system treats it as plain text. The AI cannot be re-purposed or hijacked by embedded commands.</p>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-6 border-green-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0"><Lock className="w-6 h-6 text-green-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Zero Fabrication + Metric Freeze</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">The system cannot invent job titles, certifications, or achievements. It also has a "Metric Freeze" — it is physically incapable of adding numbers, percentages, or dollar amounts that weren't in your original CV. If the AI tries, the Zod Schema Firewall strips them automatically.</p>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-6 border-blue-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0"><Eye className="w-6 h-6 text-blue-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Zod Schema Firewall</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">Think of this as a security checkpoint for AI output. Every piece of text the AI produces is checked by a strict validator. If it contains placeholders like "undefined" or invented metrics like "25%", the validator either strips them or rejects the output and falls back to a safe rule-based version.</p>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-6 border-purple-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0"><Layers className="w-6 h-6 text-purple-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Semantic-Only Designer</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">The Designer <strong>never writes CSS, HTML, or inline styles</strong>. It only converts your natural language intent into semantic actions like <code>set_theme</code>, <code>set_layout</code>, and <code>set_section_variant</code>. These actions update a DesignComposition object, which a deterministic renderer converts to HTML with CSS variables. The LLM cannot output raw CSS selectors, hex codes, font names, or pixel values. Even if prompted to "make the heading red 24px bold", it can only emit <code>set_emphasis_style: bold</code> — the actual rendering is deterministic and controlled by the theme system.</p>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-6 border-orange-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0"><Shield className="w-6 h-6 text-orange-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Three-Tier Security Architecture</h3>
                    <p className="text-slate-400 text-sm leading-relaxed"><strong>Layer 1 (System):</strong> Prompt-level guards in every agent — ignores embedded commands in CV/job text. <strong>Layer 2 (Data):</strong> Zod schema validation with .catch() fallbacks for all AI output. <strong>Layer 3 (Content):</strong> DOMPurify + JSDOM final-stage HTML sanitization strips &lt;script&gt;, &lt;iframe&gt;, &lt;object&gt;, all on* event handlers, and javascript:/data: URIs before PDF generation.</p>
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-xl p-6 border-cyan-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0"><Shield className="w-6 h-6 text-cyan-400" /></div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">100% Local</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">Everything runs on your own computer via Ollama. Your CV data never leaves your machine. There are no API keys, no cloud accounts, and no third-party services processing your personal information. Even the database is a local SQLite file.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
