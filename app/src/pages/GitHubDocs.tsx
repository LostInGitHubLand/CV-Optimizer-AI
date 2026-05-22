import { Link } from "react-router";
import {
  ArrowLeft, BookOpen, Code, GitBranch, Layers,
  Zap, Database, Cpu, Download, Shield,
  PenTool, Palette, Ban, Lock, Eye, Wand2,
} from "lucide-react";

export default function GitHubDocs() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <header className="border-b border-cyan-500/10 backdrop-blur-sm bg-[#0a0a1a]/80 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to CV Optimizer
          </Link>
          <span className="text-sm font-semibold neon-text">CV Optimizer AI</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12 animate-slide-up">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="neon-text bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Project Documentation</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-6">
            Complete technical reference for CV Optimizer AI — architecture, API, agents, and deployment.
            Built on a <strong className="text-cyan-400">Structure-First</strong> strategy: reorganization and rephrasing without metric invention.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-3 py-1.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">React 19 + TypeScript</span>
            <span className="text-xs px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">Hono + tRPC 11.x</span>
            <span className="text-xs px-3 py-1.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 font-mono">SQLite + Drizzle ORM</span>
            <span className="text-xs px-3 py-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">Ollama (qwen3)</span>
          </div>
        </div>

        <div className="space-y-12">
          {/* Overview */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-cyan-400" /> Overview</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                CV Optimizer AI is a fully local, free, open-source application that generates tailored CVs using 4 specialized AI agents.
                It implements a <strong className="text-cyan-400">Structure-First</strong> optimization strategy: the system forbids the invention
                of metrics/numbers but allows deep structural and terminological re-organization.
              </p>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Think of it as a <strong>data curator</strong> (Analyst) + <strong>content refiner</strong> (Writer) + <strong>layout engine</strong> (Designer)
                working in sequence — not a ghostwriter that fabricates your career.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/20"><strong className="text-cyan-400 text-sm">Input:</strong> <span className="text-slate-400 text-sm">PDF CV or website URL + Job Advert</span></div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/20"><strong className="text-purple-400 text-sm">Output:</strong> <span className="text-slate-400 text-sm">Markdown + HTML + PDF optimized CV</span></div>
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/20"><strong className="text-pink-400 text-sm">AI:</strong> <span className="text-slate-400 text-sm">Ollama with qwen3 (all agents)</span></div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20"><strong className="text-emerald-400 text-sm">Cost:</strong> <span className="text-slate-300 text-sm">Zero — completely free, no API keys, no subscription, no data leaves your computer</span></div>
              </div>
            </div>
          </section>

          {/* Structure-First Strategy */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Wand2 className="w-5 h-5 text-cyan-400" /> Structure-First Strategy</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="pb-2 text-slate-400 font-medium">Traditional AI CV Builder</th>
                      <th className="pb-2 text-cyan-400 font-medium">Structure-First (This System)</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {[
                      ["AI invents metrics (\"increased revenue by 25%\")", "AI never invents numbers, percentages, or dollar amounts"],
                      ["AI adds fake achievements to sound impressive", "AI only reorganizes and rephrases what you actually did"],
                      ["AI expands 1-line tasks into 3 paragraphs", "AI adds maximum 1 sentence, under 20 words per entry"],
                      ["AI removes \"irrelevant\" experience", "AI keeps all experience and reorders it by relevance"],
                      ["Output is a creative rewrite of your career", "Output is a curated presentation of your real career"],
                    ].map(([traditional, structureFirst], i) => (
                      <tr key={i} className="border-b border-slate-800/50 last:border-0">
                        <td className="py-2 pr-4 text-slate-400">{traditional}</td>
                        <td className="py-2 text-cyan-300">{structureFirst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Architecture</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30 space-y-4">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                <h3 className="text-sm font-semibold text-white mb-2">Pipeline Flow</h3>
                <pre className="text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`User Input (PDF/URL + Job Advert + CV Updates)
    |
FETCHER (qwen3) → JsonProfile { name, skills, experience, education, projects, ... }
                  [Zod: JsonProfileSchema — placeholder stripping]
    |
ANALYST (qwen3) → JsonStrategy { keep, remove, strategy, inferredStrengths, layoutDirectives }
                  [Zod: AnalystStrategySchema — structural validation, metric-free output]
                  Data Curator: Hierarchy Shifting, Semantic Highlighting, Qualitative Detailing
    |
WRITER (qwen3) → JsonCv + Markdown CV
                  [Deterministic build — AI only rephrases, never maps data]
                  [Schema Firewall: stripInventedMetrics() on all text fields]
                  [Metric Freeze, Expansion Limit: 1 sentence / 20 words, Action Verbs Only]
                  [VRAM UNLOAD: fires keep_alive:0 after final output]
    |
DESIGNER (qwen3) → SemanticDesignAction[] → DesignComposition → DesignState → HTML + PDF
                  [Semantic Parser: rule-based first, LLM fallback when needed]
                  [applySemanticActionsToComposition() → DesignComposition]
                  [resolveDesignState() → DesignState]
                  [renderSemanticHtml() → deterministic HTML with CSS variables]
                  [VRAM UNLOAD: fires keep_alive:0 after final output]
    |
REVIEW ──→ Preview PDF + Markdown. User decides:
    |
    ├─ "Refine" ──→ REVIEW & REFINE LOOP (repeatable)
    │     Writer (qwen3) ── content changes or editedMarkdown ──→ updates JsonCv + Markdown
    │     Designer (qwen3) ── semantic design changes → re-renders HTML + PDF
    │     ↓
    └─ "I'm so satisfied" → completed (loop exits, model unloaded)`}
                </pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-white mb-2">JSON Pipeline</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">Agents communicate via structured JSON objects, not text parsing. Zod schemas validate every AI output with `.catch()` fallbacks for AI-hardening. Schema Firewall strips invented metrics at the type level.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-white mb-2">Semantic Design Engine</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">Natural language → Semantic Parser (rule-based + LLM fallback) → SemanticDesignAction[] → applySemanticActionsToComposition() → DesignComposition → resolveDesignState() → DesignState → renderSemanticHtml() → HTML/PDF. DesignComposition is the persistent semantic source of truth: layoutId, themeId, semanticState, sectionLayout, sectionVariants, sectionDataOverrides, renderingOverrides. 3 layouts, 11 themes, per-section variants. The LLM never outputs CSS, HTML, or inline styles — only semantic actions.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-white mb-2">Rule-Based Fallback System</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">Every AI agent has a deterministic fallback when Ollama is offline or AI output fails validation. Analyst uses keyword/synonym scoring + IndustryMatcher. Writer uses pure TypeScript deterministic build. Designer templates are always pure TypeScript.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-white mb-2">Zod Schema Firewall</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">Three active defense layers: (1) Placeholder Stripping — replaces "undefined"/"N/A" with empty strings. (2) Active Sanitization — regex strips invented metrics like "25%" or "$50K" from descriptions. (3) Structural Validation — ensures sectionOrder contains only valid keys.</p>
                </div>
              </div>
            </div>
          </section>

          {/* VRAM Management */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Cpu className="w-5 h-5 text-cyan-400" /> VRAM Management</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <p className="text-slate-400 text-sm mb-4">
                The system implements automatic VRAM management to prevent GPU memory exhaustion during long refinement sessions.
                Each AI agent triggers a background unload request after its final output.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">Background Unload</h3>
                  <p className="text-slate-400 text-xs">After Writer and Designer finish generating output, a non-blocking <code className="text-cyan-300">fetch()</code> fires to Ollama with <code className="text-cyan-300">keep_alive: 0</code>. This immediately unloads the model from VRAM without blocking the pipeline response.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">300-Second Timeout</h3>
                  <p className="text-slate-400 text-xs">The global Ollama fetch timeout is set to 300 seconds (5 minutes) to accommodate model loading overhead on slower GPUs. The unload request itself uses a 10-second timeout.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">Per-Agent Trigger</h3>
                  <p className="text-slate-400 text-xs">Writer passes <code className="text-cyan-300">unloadAfter: true</code> on both <code className="text-cyan-300">generateAICV</code> (MAIN_STATE) and <code className="text-cyan-300">applyRefinementAI</code> (REFINE_STATE). Designer passes it on <code className="text-cyan-300">generateStyleAdjustment</code>.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">Fire-and-Forget</h3>
                  <p className="text-slate-400 text-xs">The unload request is intentionally fire-and-forget. A <code className="text-cyan-300">.catch()</code> handler silently absorbs any network errors so the pipeline never fails because of a background unload attempt.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Agents */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Cpu className="w-5 h-5 text-pink-400" /> The 4 Agents</h2>
            <div className="space-y-4">
              {[
                { name: "FETCHER", role: "Profile Extractor", model: "qwen3", icon: <Zap className="w-4 h-4" />, color: "text-cyan-400", desc: "Extracts profile from PDF (pdf-parse) or URL (Puppeteer + Cheerio). Detects domain (Tech/Legal/Medical/Creative). Merges CV Updates. Outputs structured JsonProfile with Zod validation." },
                { name: "ANALYST", role: "Data Curator", model: "qwen3", icon: <BookOpen className="w-4 h-4" />, color: "text-purple-400", desc: "Compares JsonProfile vs job advert. Outputs keep/remove strategy + inferred strengths + layoutDirectives (sectionOrder, topSkills, emphasisColor). Uses Emphasis Techniques: Hierarchy Shifting, Semantic Highlighting, Qualitative Detailing. Zod-validated with structural validation. Never invents metrics." },
                { name: "WRITER", role: "Content Refiner", model: "qwen3", icon: <PenTool className="w-4 h-4" />, color: "text-pink-400", desc: "Generates Markdown + JsonCv from profile + strategy. Deterministic build — AI only rephrases, never maps data. Metric Freeze enforced. Expansion Limit: max 1 additional sentence, under 20 words per entry. Action Verbs Only. Verisimilar Skill Mapping. After each run, fires a background VRAM unload request (keep_alive:0) to free GPU memory." },
                { name: "DESIGNER", role: "Semantic Design Engine", model: "qwen3", icon: <Palette className="w-4 h-4" />, color: "text-amber-400", desc: "Natural language instruction → Semantic Parser (rule-based + LLM fallback) → SemanticDesignAction[] → applySemanticActionsToComposition() → DesignComposition → resolveDesignState() → DesignState → renderSemanticHtml() → deterministic HTML/PDF. 3 layouts, 11 themes, per-section variants. The LLM never outputs CSS, HTML, or inline styles. After each run, fires a background VRAM unload request (keep_alive:0) to free GPU memory." },
              ].map((agent) => (
                <div key={agent.name} className="glass-panel rounded-xl p-4 border-slate-700/30 flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">{agent.icon}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-sm ${agent.color}`}>{agent.name}</span>
                      <span className="text-xs text-slate-500">{agent.role}</span>
                      <span className="text-xs font-mono text-slate-500">{agent.model}</span>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">{agent.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Emphasis Techniques */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Wand2 className="w-5 h-5 text-purple-400" /> Emphasis Techniques (Analyst)</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <p className="text-slate-400 text-sm mb-4">The Analyst is not an optimizer — it is a Data Curator. Its only permitted tools are:</p>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">Hierarchy Shifting</h3>
                  <p className="text-slate-400 text-xs">Reorders CV sections so the most job-relevant evidence appears first. If Projects match the job better than Education, Projects move higher. If Certifications are highly relevant, they appear immediately after Experience.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">Semantic Highlighting</h3>
                  <p className="text-slate-400 text-xs">Within each experience entry, lists the most job-relevant bullet points first. A management job gets "Led team coordination" before "Updated documentation". The order of bullets is rearranged, not rewritten.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-cyan-400 mb-1">Qualitative Detailing</h3>
                  <p className="text-slate-400 text-xs">Suggests jargon-matched rephrasings for the Writer without adding new facts. "Wrote code" becomes "Implemented backend logic" only if the original role justifies it. No new numbers, no new achievements.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Writer Constraints */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Ban className="w-5 h-5 text-red-400" /> Writer Constraints (Content Refiner)</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-red-400 mb-1">Metric Freeze</h3>
                  <p className="text-slate-400 text-xs">Never insert any numerical value, percentage, dollar amount, team size, or KPI not explicitly stated in the source JSON. "Led the team" with no number cannot become "Led a team of 12 people".</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-amber-400 mb-1">Expansion Limit</h3>
                  <p className="text-slate-400 text-xs">Any contextual expansion must not exceed ONE additional sentence per entry and must stay under 20 words of new text. Prevents CV bloat and gradual fabrication.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-green-400 mb-1">Action Verbs Only</h3>
                  <p className="text-slate-400 text-xs">Replace generic verbs with precise, high-impact action verbs. "Assisted" → "Coordinated". "Helped" → "Enabled". "Worked on" → "Developed". "Responsible for" → "Led". Every bullet must start with a strong action verb.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                  <h3 className="text-sm font-semibold text-blue-400 mb-1">Verisimilar Skill Mapping</h3>
                  <p className="text-slate-400 text-xs">Clarify a task only when the original description implies the use of specific skills required by the Job Ad. Do not implement far-fetched or "forced" professional associations.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Domain → Layout Inference */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Layers className="w-5 h-5 text-cyan-400" /> Domain → Layout Inference</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <p className="text-slate-400 text-sm mb-4">
                The system infers the initial layout from the detected domain and profile structure.
                Layout is one of 3 canonical options. Theme is chosen from 11 visual identities.
                The user can override either at any time via natural language refinement.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { domain: "General / Unknown", layout: "single-column", theme: "minimal-swiss", desc: "Clean top-to-bottom, safest fallback" },
                  { domain: "Tech", layout: "sidebar-left", theme: "technical-dark", desc: "Sidebar for skills, main for experience" },
                  { domain: "Legal", layout: "sidebar-right", theme: "elegant-premium", desc: "Formal, right sidebar for certifications" },
                  { domain: "Medical", layout: "sidebar-right", theme: "monochrome-corporate", desc: "Institutional, right sidebar" },
                  { domain: "Creative", layout: "sidebar-left", theme: "glassmorphism", desc: "Sidebar for skills, expressive theme" },
                ].map((d) => (
                  <div key={d.domain} className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-cyan-400">{d.domain}</span>
                      <span className="text-xs text-slate-500">→</span>
                      <span className="text-sm font-semibold text-white">{d.layout}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{d.desc}</p>
                    <p className="text-slate-500 text-xs mt-1">Theme: <span className="text-cyan-400">{d.theme}</span></p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* API */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Code className="w-5 h-5 text-green-400" /> tRPC API</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <pre className="text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`cv.createJob          → { id: number }
cv.uploadPdf          → { filePath: string }
cv.processJob         → { started: true }
cv.submitUpdates      → { success: true }
cv.refine             → { started: true }  // writerInstruction + designerInstruction + editedMarkdown?
cv.satisfied          → { success: true }
cv.getJob             → CvJob
cv.getJobProgress     → { status, currentAgent, agentMessage, strategyData? }
cv.getJobStrategy     → StrategyData | null
cv.getLatestVersion   → CvVersion | null     // Two-state system: MAIN_STATE vs REFINE_STATE
cv.getMarkdown        → { markdown: string }
cv.getHtml            → { html: string }
cv.downloadPdf        → { base64: string }
cv.testPipeline       → { jobId: number }
cv.checkOllama        → { available: boolean, message: string }

SSE /api/progress/:jobId
  Real-time EventSource streaming. Agents:
    FETCHER, ANALYST, WRITER, DESIGNER
  Refinement sub-steps:
    WRITER_REFINE, DESIGNER_REFINE`}
              </pre>
            </div>
          </section>

          {/* Database */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-blue-400" /> Database Schema</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30">
              <pre className="text-xs text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`cv_jobs {
  id, inputType, sourceUrl, pdfPath, rawText, updates, jobAdvert
  jsonProfile, jsonStrategy, jsonCv       // JSON pipeline fields
  status                                  // pending → fetching → analyzing → writing
                                          //   → designing → awaiting_review → refining
                                          //   → completed | error
  currentAgent, agentMessage
  fetcherOutput, analystOutput, writerOutput
  markdownOutput, htmlOutput, pdfPathOutput
  designComposition                       // persistent semantic source of truth
  designState                             // resolved concrete rendering state
  backupHtml, backupMarkdown              // Refinement rollback support
  errorMessage
  createdAt, updatedAt
}

cv_versions {                             // Two-state version tracking
  id, jobId, sessionId, state             // "main" | "refine"
  version                                 // incrementing per session
  json_cv, markdown_content, html_content
  pdf_path, design_composition, instruction
  createdAt
}`}
              </pre>
            </div>
          </section>

          {/* Security */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-red-400" /> Security & Zod Schema Firewall</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0"><Ban className="w-5 h-5 text-red-400" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Prompt Injection Protection</h3>
                    <p className="text-slate-400 text-xs">All agents have SECURITY RULES in system prompts. They ignore embedded commands like "ignore previous instructions" found in CV/job text.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0"><Lock className="w-5 h-5 text-green-400" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Zero Fabrication + Metric Freeze</h3>
                    <p className="text-slate-400 text-xs">Analyst and Writer cannot invent titles, certifications, or metrics. Global prohibition on invented numbers, percentages, or KPIs.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0"><Eye className="w-5 h-5 text-blue-400" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Zod Validation + Active Sanitization</h3>
                    <p className="text-slate-400 text-xs">Every AI output parsed through Zod schemas with `.catch()` fallbacks. SanitizedString strips placeholders. MetricSanitizedString strips invented metrics via regex patterns at the schema level.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-orange-400" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">Three-Tier Security Architecture</h3>
                    <p className="text-slate-400 text-xs">Layer 1: Prompt-level guards (core-rules.ts). Layer 2: Zod schema validation with .catch() fallbacks. Layer 3: DOMPurify + JSDOM final-stage HTML sanitization — strips &lt;script&gt;, &lt;iframe&gt;, &lt;object&gt;, all on* event handlers, javascript:/data: URIs. Preserves &lt;style&gt; blocks.</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-cyan-400" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">100% Local</h3>
                    <p className="text-slate-400 text-xs">Everything runs via Ollama on your machine. No data leaves your computer. No API keys needed. No cloud dependencies.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Deployment */}
          <section className="animate-slide-up">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><GitBranch className="w-5 h-5 text-amber-400" /> Deployment</h2>
            <div className="glass-panel rounded-xl p-6 border-slate-700/30 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Prerequisites</h3>
                <ul className="text-slate-400 text-xs space-y-1">
                  <li>• Node.js 20+</li>
                  <li>• Ollama installed: <a href="https://ollama.com" className="text-cyan-400 hover:underline" target="_blank" rel="noopener">https://ollama.com</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Setup</h3>
                <pre className="text-xs text-slate-400 font-mono bg-slate-900/50 p-3 rounded-lg overflow-x-auto">
{`git clone <repo-url>
cd cv-optimizer-ai
npm install
ollama pull qwen3
npm run db:push
npm run dev`}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">Build</h3>
                <pre className="text-xs text-slate-400 font-mono bg-slate-900/50 p-3 rounded-lg overflow-x-auto">
{`npm run build
# Output: dist/ with static frontend + server`}
                </pre>
              </div>
            </div>
          </section>

          {/* License */}
          <section className="animate-slide-up">
            <div className="glass-panel rounded-xl p-6 border-slate-700/30 text-center">
              <p className="text-slate-400 text-sm">
                <strong className="text-white">MIT License</strong> — Every component is open-source and free.
              </p>
              <p className="text-slate-500 text-xs mt-2">Built with React, Hono, tRPC, Drizzle ORM, Ollama, and Puppeteer.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
