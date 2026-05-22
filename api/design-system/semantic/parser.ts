/**
 * Design System — Semantic Action Parser
 *
 * Hybrid parser: rule-based first, AI fallback second, strict validation always.
 *
 * CRITICAL RULE: Color/theme requests MUST NEVER emit set_layout.
 * Only EXPLICIT layout requests may emit set_layout.
 */

import type { Logger } from "../../infrastructure/logging/logger";
import { chatWithOllamaJSON } from "../../infrastructure/ai/ollama";
import type { TokenReporter } from "../../infrastructure/ai/ollama";
import { SEMANTIC_DESIGN_SCHEMA } from "./schema";
import type { SemanticDesignAction } from "./actions";
import { THEMES, findThemesByMeta } from "../themes/registry";

// ═══════════════════════════════════════════════════════════════════════════
// VALID ACTION TYPES — for LLM output validation
// ═══════════════════════════════════════════════════════════════════════════

const VALID_ACTION_TYPES = new Set([
  "set_layout", "set_theme", "set_color_mood", "set_density", "set_tone",
  "set_visual_balance", "set_emphasis_style", "move_section",
  "move_section_to_area", "set_section_variant", "apply_preset",
  "set_skill_level", "set_all_skill_levels", "set_language_level",
  "set_language_proficiency",
]);

const VALID_LAYOUTS = new Set([
  "single-column", "sidebar-left", "sidebar-right",
]);

const VALID_THEMES = new Set([
  "minimal-swiss", "modern-editorial", "elegant-premium", "brutalist",
  "technical-dark", "neon-cyberpunk", "glassmorphism", "monochrome-corporate",
  "luxury-serif", "clean-startup", "dark-academic",
]);

/**
 * Parse a user instruction into semantic design actions.
 * Rule-based only. Fast, deterministic, safe.
 */
export function parseSemanticActions(instruction: string, log: Logger): SemanticDesignAction[] {
  const lower = instruction.toLowerCase().trim();
  const actions: SemanticDesignAction[] = [];

  // ── Layout changes (EXPLICIT only — must be unambiguous) ──
  parseLayoutChanges(lower, actions);

  // ── Theme changes (exact theme ID names) ──
  parseThemeChanges(lower, actions);

  // ── Color/theme adjectives that affect theme (NOT layout) ──
  parseColorThemeAdjectives(lower, actions);

  // ── Section Variants ──
  parseSectionVariants(lower, actions);

  // ── Section area moves ──
  parseSectionAreaMoves(lower, actions);

  // ── Section reorder ──
  parseSectionReorder(lower, actions);

  // ── Density ──
  parseDensity(lower, actions);

  // ── Tone ──
  parseTone(lower, actions);

  // ── Color mood ──
  parseColorMood(lower, actions);

  // ── Visual balance ──
  parseVisualBalance(lower, actions);

  // ── Emphasis style ──
  parseEmphasisStyle(lower, actions);

  // ── Skill levels ──
  parseSkillLevels(lower, actions);

  // ── Language levels ──
  parseLanguageLevels(lower, actions);

  // ── Presets ──
  parsePresets(lower, actions);

  if (actions.length === 0) {
    log.info("PARSER", `No rule-based actions for: "${instruction}"`);
  } else {
    log.info("PARSER", `Rule-based parsed ${actions.length} action(s): ${actions.map((a) => a.type).join(", ")}`);
  }

  return actions;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT PARSER — explicit structural intent only
// ═══════════════════════════════════════════════════════════════════════════

/** Parse EXPLICIT layout requests ONLY. Theme/color requests must NOT trigger this. */
function parseLayoutChanges(lower: string, actions: SemanticDesignAction[]): void {
  // High-confidence layout patterns — no "layout" keyword required
  const layoutPatterns: [RegExp, string][] = [
    // sidebar right (must be first — more specific)
    [/\bsidebar\s+(?:on\s+the\s+)?right\b|\bright\s+sidebar\b/, "sidebar-right"],
    // sidebar left
    [/\bsidebar\s+(?:on\s+the\s+)?left\b|\bleft\s+sidebar\b/, "sidebar-left"],
    // single column
    [/\bsingle\s+column\b|\bone\s+column\b|\bno\s+sidebar\b|\bsimple\s+layout\b/, "single-column"],
    // creative/magazine requests → sidebar-left (asymmetric-grid removed)
    [/\bcreative\s+layout\b|\bmagazine\s+layout\b/, "sidebar-left"],
  ];

  for (const [pattern, layout] of layoutPatterns) {
    if (pattern.test(lower)) {
      // Safety: don't emit set_layout if this looks like a theme/color request
      // e.g. "sidebar theme" or "sidebar color" should NOT change layout
      if (/\btheme\b|\bcolor\b|\bstyle\b/.test(lower) && !/\blayout\b|\b(change|switch|use|to)\b/.test(lower)) {
        continue;
      }
      actions.push({ type: "set_layout", layout });
      return; // Only one layout change per instruction
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME PARSER — exact theme ID names
// ═══════════════════════════════════════════════════════════════════════════

function parseThemeChanges(lower: string, actions: SemanticDesignAction[]): void {
  const themePatterns: Record<string, RegExp> = {
    "minimal-swiss": /\bminimal-swiss\b/,
    "modern-editorial": /\bmodern-editorial\b/,
    "elegant-premium": /\belegant-premium\b/,
    "brutalist": /\bbrutalist\b/,
    "technical-dark": /\btechnical-dark\b/,
    "neon-cyberpunk": /\bneon-cyberpunk\b/,
    "glassmorphism": /\bglassmorphism\b/,
    "monochrome-corporate": /\bmonochrome-corporate\b/,
    "luxury-serif": /\bluxury-serif\b/,
    "clean-startup": /\bclean-startup\b/,
    "dark-academic": /\bdark-academic\b/,
  };
  for (const [themeId, pattern] of Object.entries(themePatterns)) {
    if (pattern.test(lower)) {
      actions.push({ type: "set_theme", theme: themeId });
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR/THEME ADJECTIVES — aesthetic intent, NEVER structural
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse color/theme adjectives that should affect theme/semanticState,
 * NEVER layout. Words like "blue", "cyberpunk", "elegant", "modern", "brutalist"
 * are aesthetic/theme requests, not structural.
 */
function parseColorThemeAdjectives(lower: string, actions: SemanticDesignAction[]): void {
  // Only emit if no explicit set_theme already emitted
  const alreadyHasTheme = actions.some((a) => a.type === "set_theme");
  if (alreadyHasTheme) return;

  // ── Deterministic brightness + colorfulness combos (checked FIRST) ──
  const constraints = extractThemeConstraints(lower);

  // Light + colorful → pick brightest, most colorful light theme
  if (constraints.wantsLight && constraints.wantsColorful) {
    const candidates = findThemesByMeta("light", "high");
    if (candidates.length > 0) {
      actions.push({ type: "set_theme", theme: candidates[0].id });
      return;
    }
    // Fallback: light + medium colorfulness
    const fallback = findThemesByMeta("light", "medium");
    if (fallback.length > 0) {
      actions.push({ type: "set_theme", theme: fallback[0].id });
      return;
    }
  }

  // Light + minimal → pick light + low colorfulness
  if (constraints.wantsLight && constraints.wantsMinimal) {
    const candidates = findThemesByMeta("light", "low");
    if (candidates.length > 0) {
      actions.push({ type: "set_theme", theme: candidates[0].id });
      return;
    }
  }

  // Dark + colorful → pick dark + high colorfulness (neon-cyberpunk)
  if (constraints.wantsDark && constraints.wantsColorful) {
    const candidates = findThemesByMeta("dark", "high");
    if (candidates.length > 0) {
      actions.push({ type: "set_theme", theme: candidates[0].id });
      return;
    }
  }

  // Just light → any light theme, prefer medium colorfulness
  if (constraints.wantsLight && !constraints.wantsDark) {
    const candidates = findThemesByMeta("light");
    if (candidates.length > 0) {
      actions.push({ type: "set_theme", theme: candidates[0].id });
      return;
    }
  }

  // Just dark → any dark theme
  if (constraints.wantsDark && !constraints.wantsLight) {
    const candidates = findThemesByMeta("dark");
    if (candidates.length > 0) {
      actions.push({ type: "set_theme", theme: candidates[0].id });
      return;
    }
  }

  // Just colorful → prefer light + high, fallback to any + high
  if (constraints.wantsColorful && !constraints.wantsLight && !constraints.wantsDark) {
    const lightHigh = findThemesByMeta("light", "high");
    if (lightHigh.length > 0) {
      actions.push({ type: "set_theme", theme: lightHigh[0].id });
      return;
    }
    const anyHigh = findThemesByMeta(undefined, "high");
    if (anyHigh.length > 0) {
      actions.push({ type: "set_theme", theme: anyHigh[0].id });
      return;
    }
  }

  // ── Named theme patterns (existing logic, checked after combos) ──
  const aestheticToTheme: [RegExp, string][] = [
    // Dark / black themes
    [/\bblack\s+theme\b/, "technical-dark"],
    [/\bdark\s+theme\b/, "technical-dark"],
    [/\bmake\s+it\s+dark\b/, "technical-dark"],
    // Named themes (specific patterns first)
    [/\bneon\s+(?:cyberpunk|theme|style)\b/, "neon-cyberpunk"],
    [/\bcyberpunk\b/, "neon-cyberpunk"],
    [/\bdark\s+academic\b/, "dark-academic"],
    [/\btechnical\s+dark\b/, "technical-dark"],
    [/\bmonochrome\s+(?:corporate|theme)\b/, "monochrome-corporate"],
    [/\bmodern\s+editorial\b/, "modern-editorial"],
    [/\belegant\s+premium\b/, "elegant-premium"],
    [/\bluxury\s+serif\b/, "luxury-serif"],
    [/\bclean\s+startup\b/, "clean-startup"],
    [/\bminimal\s+swiss\b/, "minimal-swiss"],
    [/\bglassmorphism\b/, "glassmorphism"],
    [/\bbrutalist\b/, "brutalist"],
    // Single-word theme indicators (lower confidence, checked last)
    [/\bneon\b/, "neon-cyberpunk"],
  ];

  for (const [pattern, theme] of aestheticToTheme) {
    if (pattern.test(lower)) {
      actions.push({ type: "set_theme", theme });
      return;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

function parseSectionVariants(lower: string, actions: SemanticDesignAction[]): void {
  // English make-patterns
  const enPatterns = [
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+a?\s*(?:timeline|cronologia|linea\s+temporale)/, variant: "timeline" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:a\s+)?(?:cards?|schede|carte)/, variant: "cards" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:compact|compatta)/, variant: "compact-tags" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:editorial|editoriale|magazine)/, variant: "editorial-flow" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:visual\s+matrix|matrice)/, variant: "visual-matrix" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:terminal|terminale)/, variant: "terminal-stack" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:expertise\s+bars|barre)/, variant: "expertise-bars" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:floating\s+cards?|fluttuante)/, variant: "floating-cards" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:accent\s+pills?|colored\s+pills?|rounded\s+tags?)/, variant: "accent-pills" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:flat\s+pills?)/, variant: "accent-pills-flat" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:icon\s+grid|griglia)/, variant: "icon-grid" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:inline|inlinea)/, variant: "inline-minimal" },
    { re: /\bmake\b\s+(?:the\s+)?(\w+)\s+(?:ribbon|nastro)/, variant: "top-ribbon" },
  ];

  // Italian patterns
  const itPatterns = [
    { re: /\b(\w+)\s+(?:come|a|in)\s+(?:timeline|cronologia|linea\s+temporale)/, variant: "timeline" },
    { re: /\b(\w+)\s+(?:come|a|in)\s+(?:cards?|schede)/, variant: "cards" },
    { re: /\b(\w+)\s+(?:come|a|in)\s+(?:compact|compatta)/, variant: "compact-tags" },
    { re: /\b(\w+)\s+(?:come|a|in)\s+(?:editorial|editoriale)/, variant: "editorial-flow" },
    { re: /\b(\w+)\s+(?:come|a|in)\s+(?:visual\s+matrix|matrice)/, variant: "visual-matrix" },
    { re: /\b(\w+)\s+(?:come|a|in)\s+(?:terminal|terminale)/, variant: "terminal-stack" },
  ];

  // Direct variant keywords (e.g. "timeline" alone)
  const directVariantKeywords: Record<string, string> = {
    timeline: "timeline", "linea temporale": "timeline", cronologia: "timeline",
    cards: "cards", schede: "cards",
    compact: "compact-tags", compatta: "compact-tags",
    terminal: "terminal-stack", terminale: "terminal-stack",
    "expertise bars": "expertise-bars", barre: "expertise-bars",
    "proficiency bars": "proficiency-bars",
    "language bars": "proficiency-bars",
    "floating cards": "floating-cards", fluttuante: "floating-cards",
    "icon grid": "icon-grid", griglia: "icon-grid",
    "visual matrix": "visual-matrix", matrice: "visual-matrix",
    "accent pills": "accent-pills", "colored pills": "accent-pills", "rounded tags": "accent-pills",
    "flat pills": "accent-pills-flat",
  };

  // Try make-pattern matching (e.g. "make experience a timeline")
  for (const { re, variant } of [...enPatterns, ...itPatterns]) {
    const m = lower.match(re);
    if (m) {
      const section = normalizeSectionName(m[1]);
      if (section) {
        actions.push({ type: "set_section_variant", section, variant });
      }
    }
  }

  // Explicit "as X" patterns for all generic sections
  // e.g. "certifications as card", "awards as timeline", "education as editorial flow"
  const sectionVariantPatterns = [
    // Generic sections
    { re: /\b(certifications?|certificat[ei]|certificates?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "certifications", variant: "cards" },
    { re: /\b(awards?|premi|riconoscimenti|honors?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "awards", variant: "cards" },
    { re: /\b(publications?|pubblicazioni|papers?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "publications", variant: "cards" },
    { re: /\b(projects?|progetti)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "projects", variant: "cards" },
    { re: /\b(volunteers?|volunteering)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "volunteers", variant: "cards" },
    { re: /\b(education|educazione|istruzione|studi|studies)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "education", variant: "cards" },
    { re: /\b(work\s+experience|professional\s+experience|experience|esperienz[ae])\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:card|carta|schede)s?/, section: "experience", variant: "cards" },
    // Timeline variants
    { re: /\b(certifications?|certificat[ei]|certificates?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "certifications", variant: "timeline" },
    { re: /\b(awards?|premi|riconoscimenti|honors?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "awards", variant: "timeline" },
    { re: /\b(publications?|pubblicazioni|papers?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "publications", variant: "timeline" },
    { re: /\b(projects?|progetti)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "projects", variant: "timeline" },
    { re: /\b(volunteers?|volunteering)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "volunteers", variant: "timeline" },
    { re: /\b(education|educazione|istruzione|studi|studies)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "education", variant: "timeline" },
    { re: /\b(work\s+experience|professional\s+experience|experience|esperienz[ae])\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:timeline|cronologia|linea\s+temporale)/, section: "experience", variant: "timeline" },
    // Editorial-flow variants
    { re: /\b(certifications?|certificat[ei]|certificates?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "certifications", variant: "editorial-flow" },
    { re: /\b(awards?|premi|riconoscimenti|honors?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "awards", variant: "editorial-flow" },
    { re: /\b(publications?|pubblicazioni|papers?)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "publications", variant: "editorial-flow" },
    { re: /\b(projects?|progetti)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "projects", variant: "editorial-flow" },
    { re: /\b(volunteers?|volunteering)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "volunteers", variant: "editorial-flow" },
    { re: /\b(education|educazione|istruzione|studi|studies)\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "education", variant: "editorial-flow" },
    { re: /\b(work\s+experience|professional\s+experience|experience|esperienz[ae])\b.*\b(?:as|in)\b\s+(?:a\s+)?(?:editorial|editoriale|editorial\s+flow)/, section: "experience", variant: "editorial-flow" },
    // Default/reset variants (removes visual variant)
    { re: /\b(certifications?|certificat[ei]|certificates?)\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "certifications", variant: "default" },
    { re: /\b(awards?|premi|riconoscimenti|honors?)\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "awards", variant: "default" },
    { re: /\b(publications?|pubblicazioni|papers?)\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "publications", variant: "default" },
    { re: /\b(projects?|progetti)\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "projects", variant: "default" },
    { re: /\b(volunteers?|volunteering)\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "volunteers", variant: "default" },
    { re: /\b(education|educazione|istruzione|studi|studies)\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "education", variant: "default" },
    { re: /\b(work\s+experience|professional\s+experience|experience|esperienz[ae])\b.*\b(?:as|to)\b\s+(?:default|reset|normal|standard)/, section: "experience", variant: "default" },
  ];

  for (const { re, section, variant } of sectionVariantPatterns) {
    if (re.test(lower)) {
      actions.push({ type: "set_section_variant", section, variant });
    }
  }

  // ── Language-specific proficiency bar patterns ──
  // "expertise bar for languages", "language proficiency bars", etc.
  const langBarPatterns = [
    { re: /\b(?:expertise\s+bar[s]?\s+(?:for\s+)?lang)/, section: "languages", variant: "proficiency-bars" },
    { re: /\b(?:lang(?:uage)?[s]?\s+(?:as\s+)?bar[s]?)/, section: "languages", variant: "proficiency-bars" },
    { re: /\b(?:lang(?:uage)?[s]?\s+(?:proficiency\s+)?bar[s]?)/, section: "languages", variant: "proficiency-bars" },
    { re: /\b(?:show\s+(?:the\s+)?lang(?:uage)?[s]?\s+(?:level|proficiency)s?)/, section: "languages", variant: "proficiency-bars" },
    { re: /\b(?:lang(?:uage)?\s+proficiency\s+(?:bar|level)s?)/, section: "languages", variant: "proficiency-bars" },
    { re: /\b(?:lang(?:uage)?[s]?\s+level[s]?\s+(?:as\s+)?bar[s]?)/, section: "languages", variant: "proficiency-bars" },
  ];

  for (const { re, section, variant } of langBarPatterns) {
    if (re.test(lower)) {
      actions.push({ type: "set_section_variant", section, variant });
    }
  }

  // Skills expertise bars — only when explicitly about skills (NOT languages)
  const skillsBarPattern = /\b(?:skills?\s+(?:expertise\s+)?bar[s]?|expertise\s+bar[s]?\s+(?:for\s+)?skills?|show\s+skills\s+as\s+bar[s]?)\b/;
  if (skillsBarPattern.test(lower) && !/\blang/.test(lower)) {
    actions.push({ type: "set_section_variant", section: "skills", variant: "expertise-bars" });
    // If no explicit skill levels were provided, default all to 100 (full bars)
    const hasExplicitLevels = /\b(?:python|java|javascript|typescript|react|node|sql|aws|docker|kubernetes|angular|vue|go|ruby|php|scala|rust|c\+\+|c#|swift|kotlin)\b.*\d/.test(lower);
    if (!hasExplicitLevels) {
      actions.push({ type: "set_all_skill_levels", level: 100 });
    }
  }

  // ── Bar removal / reset patterns ──
  // Skills: "remove bars from skills", "skills without bars", "reset skills visual"
  if (/\b(?:remove|reset|without|no)\b.*\b(?:skills?\s+(?:expertise\s+)?bar[s]?|bar[s]?\s+(?:from\s+)?skills?)\b/.test(lower) ||
      /\b(?:skills?)\b.*\b(?:without\s+bar[s]?|reset\s+visual|normal|default)\b/.test(lower)) {
    actions.push({ type: "set_section_variant", section: "skills", variant: "default" });
  }
  // Languages: "remove language bars", "languages without bars", "reset languages visual"
  if (/\b(?:remove|reset|without|no)\b.*\b(?:lang(?:uage)?[s]?\s+(?:proficiency\s+)?bar[s]?|bar[s]?\s+(?:from\s+)?lang)/.test(lower) ||
      /\b(?:lang(?:uage)?[s]?)\b.*\b(?:without\s+bar[s]?|reset\s+visual|normal|default)\b/.test(lower)) {
    actions.push({ type: "set_section_variant", section: "languages", variant: "default" });
  }

  // ── Contacts variant patterns ──
  const contactsVariantPatterns = [
    { re: /\b(?:contacts?|contatti)\b.*\b(?:inline|minimal|in.line|in line|compact)\b/, section: "contacts", variant: "inline-minimal" },
    { re: /\b(?:inline|minimal|in.line|in line|compact)\b.*\b(?:contacts?|contatti)\b/, section: "contacts", variant: "inline-minimal" },
    { re: /\b(?:contacts?|contatti)\b.*\b(?:icon.grid|grid.of.icons|icon grid)\b/, section: "contacts", variant: "icon-grid" },
    { re: /\b(?:icon.grid|grid.of.icons|icon grid)\b.*\b(?:contacts?|contatti)\b/, section: "contacts", variant: "icon-grid" },
    { re: /\b(?:contacts?|contatti)\b.*\b(?:top.ribbon|ribbon|top.bar)\b/, section: "contacts", variant: "top-ribbon" },
    { re: /\b(?:top.ribbon|ribbon|top.bar)\b.*\b(?:contacts?|contatti)\b/, section: "contacts", variant: "top-ribbon" },
    { re: /\b(?:contacts?|contatti)\b.*\b(?:sidebar.stack|vertical|side.stack|sidebar)\b/, section: "contacts", variant: "sidebar-stack" },
    { re: /\b(?:sidebar.stack|vertical|side.stack)\b.*\b(?:contacts?|contatti)\b/, section: "contacts", variant: "sidebar-stack" },
  ];

  for (const { re, section, variant } of contactsVariantPatterns) {
    if (re.test(lower)) {
      actions.push({ type: "set_section_variant", section, variant });
    }
  }

  // Try direct keyword with section context (existing logic preserved)
  for (const [keyword, variant] of Object.entries(directVariantKeywords)) {
    if (lower.includes(keyword)) {
      let section = extractSectionName(lower);
      // Default section fallbacks for common keywords
      if (!section) {
        if (keyword === "timeline" || keyword === "linea temporale" || keyword === "cronologia") {
          section = "experience";
        }
        if (keyword === "visual matrix" || keyword === "matrice") {
          section = "skills";
        }
        if (keyword === "proficiency bars" || keyword === "language bars") {
          section = "languages";
        }
      }
      if (section) {
        actions.push({ type: "set_section_variant", section, variant });
        break;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION AREA MOVES
// ═══════════════════════════════════════════════════════════════════════════

function parseSectionAreaMoves(lower: string, actions: SemanticDesignAction[]): void {
  const patterns = [
    { re: /\bmove\b\s+(?:the\s+)?(\w+)\s+(?:to\s+)?(?:the\s+)?sidebar\b/, area: "sidebar" as const },
    { re: /\bmove\b\s+(?:the\s+)?(\w+)\s+(?:to\s+)?(?:the\s+)?main\b/, area: "main" as const },
    { re: /\bput\b\s+(?:the\s+)?(\w+)\s+(?:in|into)\s+(?:the\s+)?sidebar\b/, area: "sidebar" as const },
    { re: /\bput\b\s+(?:the\s+)?(\w+)\s+(?:in|into)\s+(?:the\s+)?main\b/, area: "main" as const },
    { re: /\bsposta\b\s+(?:il\/la\s+)?(\w+)\s+(?:nella\s+)?sidebar\b/, area: "sidebar" as const },
    { re: /\bsposta\b\s+(?:il\/la\s+)?(\w+)\s+(?:nel\s+)?main\b/, area: "main" as const },
  ];
  for (const { re, area } of patterns) {
    const m = lower.match(re);
    if (m) {
      const section = normalizeSectionName(m[1]);
      if (section) actions.push({ type: "move_section_to_area", section, area });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION REORDER
// ═══════════════════════════════════════════════════════════════════════════

function parseSectionReorder(lower: string, actions: SemanticDesignAction[]): void {
  const moveMatch = lower.match(/\bmove\b\s+(?:the\s+)?(\w+)\s+(above|before|after|below)\s+(?:the\s+)?(\w+)/);
  if (moveMatch) {
    const [, section, position, reference] = moveMatch;
    const normalizedPos = position === "above" ? "before" : position === "below" ? "after" : position;
    const ns = normalizeSectionName(section);
    const nr = normalizeSectionName(reference);
    if (ns && nr) actions.push({ type: "move_section", section: ns, position: normalizedPos, reference: nr });
  }

  const topMatch = lower.match(/\bmove\b\s+(?:the\s+)?(\w+)\s+to\s+(top|first)/);
  if (topMatch) {
    const ns = normalizeSectionName(topMatch[1]);
    if (ns) actions.push({ type: "move_section", section: ns, position: "top" });
  }

  const bottomMatch = lower.match(/\bmove\b\s+(?:the\s+)?(\w+)\s+to\s+(bottom|last)/);
  if (bottomMatch) {
    const ns = normalizeSectionName(bottomMatch[1]);
    if (ns) actions.push({ type: "move_section", section: ns, position: "bottom" });
  }

  // Italian
  const itMove = lower.match(/\bsposta\b\s+(?:il\/la\s+)?(\w+)\s+(prima|dopo)\s+(?:di\s+)?(\w+)/);
  if (itMove) {
    const [, section, position, reference] = itMove;
    const ns = normalizeSectionName(section);
    const nr = normalizeSectionName(reference);
    if (ns && nr) actions.push({ type: "move_section", section: ns, position: position === "prima" ? "before" : "after", reference: nr });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC STATE PARSERS
// ═══════════════════════════════════════════════════════════════════════════

function parseDensity(lower: string, actions: SemanticDesignAction[]): void {
  if (/\bcompact\b|\bdense\b|\bdensa\b/.test(lower)) {
    actions.push({ type: "set_density", value: "compact" });
  } else if (/\bspacious\b|\bwide\b|\broomy\b|\bampia\b/.test(lower)) {
    actions.push({ type: "set_density", value: "spacious" });
  }
}

function parseTone(lower: string, actions: SemanticDesignAction[]): void {
  if (/\bmodern\b/.test(lower)) actions.push({ type: "set_tone", value: "modern" });
  else if (/\belegant\b/.test(lower)) actions.push({ type: "set_tone", value: "elegant" });
  else if (/\bcorporate\b/.test(lower)) actions.push({ type: "set_tone", value: "corporate" });
  else if (/\bcreative\b/.test(lower)) actions.push({ type: "set_tone", value: "creative" });
  else if (/\bminimal\b/.test(lower) && !/\bminimal-swiss\b/.test(lower)) actions.push({ type: "set_tone", value: "minimal" });
}

function parseColorMood(lower: string, actions: SemanticDesignAction[]): void {
  if (/\bprofessional\b/.test(lower)) actions.push({ type: "set_color_mood", value: "professional" });
  else if (/\bbold\b/.test(lower)) actions.push({ type: "set_color_mood", value: "bold" });
  else if (/\bmuted\b/.test(lower)) actions.push({ type: "set_color_mood", value: "muted" });
}

function parseVisualBalance(lower: string, actions: SemanticDesignAction[]): void {
  if (/\bconservative\b/.test(lower)) actions.push({ type: "set_visual_balance", value: "conservative" });
  else if (/\bexpressive\b/.test(lower)) actions.push({ type: "set_visual_balance", value: "expressive" });
}

function parseEmphasisStyle(lower: string, actions: SemanticDesignAction[]): void {
  if (/\bminimal\b.*\bemphasis\b|\bsubtle\b.*\bemphasis\b/.test(lower)) {
    actions.push({ type: "set_emphasis_style", value: "minimal" });
  } else if (/\bstrong\b.*\bemphasis\b|\bbold\b.*\bhierarchy\b/.test(lower)) {
    actions.push({ type: "set_emphasis_style", value: "strong" });
  }
}

function parsePresets(lower: string, actions: SemanticDesignAction[]): void {
  const presetPatterns: Record<string, RegExp> = {
    modern: /\bapply\b.*\bmodern\b/,
    corporate: /\bapply\b.*\bcorporate\b/,
    academic: /\bapply\b.*\bacademic\b/,
    startup: /\bapply\b.*\bstartup\b/,
    executive: /\bapply\b.*\bexecutive\b/,
    creative: /\bapply\b.*\bcreative\b/,
    minimal: /\bapply\b.*\bminimal\b/,
    elegant: /\bapply\b.*\belegant\b/,
  };
  for (const [preset, pattern] of Object.entries(presetPatterns)) {
    if (pattern.test(lower)) {
      actions.push({ type: "apply_preset", preset });
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const SECTION_ALIASES: Record<string, string> = {
  experience: "experience", esperienza: "experience", esperienze: "experience",
  "work experience": "experience", "professional experience": "experience",
  work: "experience", lavoro: "experience",
  education: "education", educazione: "education", istruzione: "education", studi: "education", studies: "education",
  skills: "skills", competenze: "skills", abilita: "skills", competencies: "skills",
  contacts: "contacts", contact: "contacts", contatti: "contacts",
  languages: "languages", language: "languages", lingue: "languages", lingua: "languages",
  certifications: "certifications", certification: "certifications", certificazioni: "certifications",
  certificate: "certifications", certificates: "certifications",
  awards: "awards", award: "awards", premi: "awards", riconoscimenti: "awards", honors: "awards", honour: "awards",
  projects: "projects", project: "projects", progetti: "projects",
  publications: "publications", publication: "publications", pubblicazioni: "publications", papers: "publications",
  interests: "interests", interest: "interests", interessi: "interests",
  summary: "summary", sommario: "summary", riassunto: "summary",
  volunteers: "volunteers", volunteer: "volunteers", volunteering: "volunteers",
};

function normalizeSectionName(name: string): string | null {
  const lower = name.toLowerCase().trim();
  return SECTION_ALIASES[lower] || null;
}

/**
 * Parse skill level instructions.
 *
 * NOTE: Broad rule-based percentage extraction is DISABLED.
 * Per-skill percentages ("Python 70, Java 90") are handled by LLM fallback
 * to avoid brittle regex matching on arbitrary input.
 *
 * Rule-based parsing only handles:
 *   - "skill level X 90" single explicit pattern
 */
function parseSkillLevels(lower: string, actions: SemanticDesignAction[]): void {
  // Single explicit pattern only: "skill level Python 90"
  const singleMatch = lower.match(/(?:skill|expertise)\s+(?:level\s+)?(\w+)\s+(\d+)\s*%?/);
  if (singleMatch) {
    const [, skill, levelStr] = singleMatch;
    actions.push({ type: "set_skill_level", skill, level: parseInt(levelStr, 10) });
  }
}

/**
 * Parse language level instructions:
 *   "set English to 90% and French to 60%"
 *   "show Italian as native and English as fluent"
 *   "make languages use proficiency bars"
 */
/** CEFR + common text levels → numeric for bar width */
const TEXT_PROF_TO_NUMERIC: Record<string, number> = {
  native: 100, "native speaker": 100, "mother tongue": 100, bilingual: 100,
  "full professional": 90, c2: 95,
  fluent: 90, c1: 90, proficient: 80, professional: 80, "working professional": 80,
  advanced: 80, b2: 80, intermediate: 60, b1: 65,
  basic: 35, a2: 45, elementary: 35,
  a1: 30, beginner: 30,
};

function parseLanguageLevels(lower: string, actions: SemanticDesignAction[]): void {
  const seenLangs = new Set<string>();
  let m: RegExpExecArray | null;

  // ── Mixed pattern: "Italian native, English B2, French professional" ──
  // Matches: Language (as) Level where Level can be text, CEFR, or professional
  const mixedPattern = /([a-z]+)\s+(?:as\s+)?(native|fluent|advanced|intermediate|basic|proficient|professional|c1|c2|b1|b2|a1|a2)/gi;
  while ((m = mixedPattern.exec(lower)) !== null) {
    const lang = m[1].trim();
    const prof = m[2].toLowerCase();
    const key = lang.toLowerCase();
    if (seenLangs.has(key)) continue;
    seenLangs.add(key);
    // Store as proficiency (text label) + numeric level for bars
    actions.push({ type: "set_language_proficiency", language: lang, proficiency: prof });
    // Also store numeric level for bar rendering
    const numericLevel = TEXT_PROF_TO_NUMERIC[prof];
    if (numericLevel !== undefined) {
      actions.push({ type: "set_language_level", language: lang, level: numericLevel });
    }
  }

  // NOTE: Broad numeric extraction ("English 90%, French 60") is DISABLED.
  // Numeric language levels are handled by LLM fallback to avoid
  // false positives from arbitrary numbers in the instruction.
}

/**
 * Extract a section name from the instruction.
 * Checks both single words and multi-word phrases.
 */
function extractSectionName(lower: string): string | null {
  // Check multi-word aliases first (longest first to match "work experience" before "experience")
  const sortedAliases = Object.entries(SECTION_ALIASES)
    .filter(([alias]) => alias.includes(" "))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [alias, section] of sortedAliases) {
    if (lower.includes(alias)) return section;
  }
  // Check single-word aliases
  const words = lower.split(/\s+/);
  for (const word of words) {
    const normalized = normalizeSectionName(word);
    if (normalized) return normalized;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME CONSTRAINT EXTRACTION & CORRECTION
// ═══════════════════════════════════════════════════════════════════════════

interface ThemeConstraints {
  wantsLight: boolean;
  wantsDark: boolean;
  wantsColorful: boolean;
  wantsMinimal: boolean;
  wantsCorporate: boolean;
}

function extractThemeConstraints(lower: string): ThemeConstraints {
  return {
    wantsLight: /\b(light|lighter|bright|brighter|white|clean)\b/.test(lower),
    wantsDark: /\b(dark|darker|black)\b/.test(lower),
    wantsColorful: /\b(colorful|vibrant|color|colou?rful|bright\s+color)\b/.test(lower),
    wantsMinimal: /\b(minimal|simple|plain|clean)\b/.test(lower),
    wantsCorporate: /\b(corporate|professional|formal|business)\b/.test(lower),
  };
}

/**
 * Correct a theme choice against explicit constraints.
 * If LLM picked a theme that violates user constraints, replace with best match.
 */
function correctThemeByConstraints(themeId: string, constraints: ThemeConstraints, log: Logger): string {
  const theme = (THEMES as Record<string, { meta: { brightness: string; colorfulness: string } }>)[themeId];
  if (!theme) return themeId;

  const { meta } = theme;
  let violation: string | null = null;

  if (constraints.wantsLight && meta.brightness === "dark") {
    violation = `user wants light but LLM chose dark theme "${themeId}"`;
  }
  if (constraints.wantsDark && meta.brightness === "light") {
    violation = `user wants dark but LLM chose light theme "${themeId}"`;
  }
  // "colorful" alone should not imply dark — only override if user also said light
  if (constraints.wantsLight && constraints.wantsColorful && meta.brightness === "dark") {
    violation = `user wants light+colorful but LLM chose dark "${themeId}"`;
  }

  if (!violation) return themeId;

  // Find replacement: closest theme matching constraints
  let candidates: { id: string; meta: { brightness: string; colorfulness: string } }[] = [];

  if (constraints.wantsLight && constraints.wantsColorful) {
    candidates = findThemesByMeta("light", "high");
    if (candidates.length === 0) candidates = findThemesByMeta("light", "medium");
  } else if (constraints.wantsLight) {
    candidates = findThemesByMeta("light");
  } else if (constraints.wantsDark && constraints.wantsColorful) {
    candidates = findThemesByMeta("dark", "high");
    if (candidates.length === 0) candidates = findThemesByMeta("dark");
  } else if (constraints.wantsDark) {
    candidates = findThemesByMeta("dark");
  }

  if (candidates.length > 0) {
    const replacement = candidates[0].id;
    log.warn("PARSER_THEME_CORRECT", `${violation} → replacing with "${replacement}"`);
    return replacement;
  }

  return themeId;
}

/**
 * Detect if the instruction explicitly mentions a specific section.
 * Returns the section name or null if no explicit section mention.
 * This is used to correct LLM drift — if user says "certifications" but
 * LLM returns actions targeting "skills", we override with "certifications".
 */
function detectExplicitSection(lower: string): string | null {
  return extractSectionName(lower);
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/** Generic section variants supported by entry-based sections (experience, education, certifications, awards, publications, projects, volunteers) */
const GENERIC_VARIANTS = new Set(["default", "cards", "timeline", "editorial-flow"]);

/** Skills-only variants — must NOT be applied to non-skills sections */
const SKILLS_VARIANTS = new Set([
  "expertise-bars", "floating-cards", "visual-matrix",
  "terminal-stack", "compact-tags", "grouped-pills",
  "accent-pills", "accent-pills-flat",
]);

/** Languages-specific variants */
const LANGUAGES_VARIANTS = new Set(["proficiency-bars", "proficiency-list", "default"]);

/** Valid emphasisStyle values */
const VALID_EMPHASIS_STYLES = new Set(["subtle", "balanced", "bold", "dramatic"]);

/** All valid variants per section type */
const SECTION_VARIANT_ALLOWLIST: Record<string, Set<string>> = {
  experience: GENERIC_VARIANTS,
  education: GENERIC_VARIANTS,
  certifications: GENERIC_VARIANTS,
  awards: GENERIC_VARIANTS,
  publications: GENERIC_VARIANTS,
  projects: GENERIC_VARIANTS,
  volunteers: GENERIC_VARIANTS,
  skills: SKILLS_VARIANTS,
  languages: LANGUAGES_VARIANTS,
  contacts: new Set(["default", "inline-minimal", "icon-grid", "top-ribbon", "sidebar-stack"]),
  interests: new Set(["default"]),
  summary: new Set(["default"]),
};

/**
 * Normalize a variant name and validate it for the target section.
 *
 * Normalizations:
 *   "card", "visual card", "card visual" → "cards"
 *   "editorial", "editorial flow" → "editorial-flow"
 *   "reset", "remove cards", "no cards", "remove timeline", "no timeline" → "default"
 *
 * Validation:
 *   Skills-only variants (floating-cards, icon-grid, etc.) applied to
 *   non-skills sections → rejected, returns "default"
 */
function normalizeVariant(variant: string, section: string): string {
  const v = variant.toLowerCase().trim();

  // ── Section-specific normalizations ──

  // Languages: map skills-looking variants to language equivalents
  if (section === "languages") {
    if (v === "expertise-bars" || v === "expertise-bar" || v === "expertise" || v === "bars" || v === "bar" || v === "levels" || v === "level" || v === "proficiency") {
      return "proficiency-bars";
    }
  }

  // Skills: normalize aliases
  if (section === "skills") {
    if (v === "compact-list" || v === "compact" || v === "compatta") return "compact-tags";
    if (v === "expertise-bars" || v === "bars" || v === "expertise" || v === "barre") return "expertise-bars";
  }

  // Generic normalizations
  if (v === "card" || v === "visual card" || v === "card visual" || v === "carta" || v === "schede") {
    return "cards";
  }
  if (v === "editorial" || v === "editorial flow" || v === "editoriale") {
    return "editorial-flow";
  }
  if (v === "reset" || v === "remove cards" || v === "no cards" || v === "remove timeline" || v === "no timeline" || v === "normal" || v === "standard") {
    return "default";
  }
  // Contacts: normalize aliases
  if (section === "contacts") {
    if (v === "inline" || v === "compact" || v === "minimal") return "inline-minimal";
    if (v === "icon-grid" || v === "icon grid" || v === "grid") return "icon-grid";
    if (v === "top-ribbon" || v === "ribbon" || v === "top bar") return "top-ribbon";
    if (v === "sidebar-stack" || v === "vertical" || v === "sidebar") return "sidebar-stack";
  }

  // ── Validation: variant must be allowed for this section ──
  const allowlist = SECTION_VARIANT_ALLOWLIST[section];
  if (allowlist && !allowlist.has(v)) {
    // If it's a skills-only variant applied to a non-skills section, force default
    if (SKILLS_VARIANTS.has(v) && section !== "skills") {
      return "default";
    }
    // Unknown variant → default (safe fallback)
    return "default";
  }

  return v;
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM FALLBACK PARSER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse semantic design actions with LLM fallback.
 *
 * 1. Try rule-based parser first (fast, deterministic, safe).
 * 2. If no rules match, call LLM with structured schema prompt.
 * 3. Validate LLM output — discard unknown action types.
 * 4. If LLM fails, return [] (silent — no error to user).
 *
 * Model: qwen3:7b — used ONLY when rule-based returns no actions.
 */
export async function parseSemanticActionsWithFallback(
  instruction: string,
  log: Logger,
  onTokens?: TokenReporter
): Promise<SemanticDesignAction[]> {
  const lower = instruction.toLowerCase().trim();
  log.info("PARSER_FALLBACK", `Processing: "${instruction}"`);

  // 1. Rule-based parsing (fast path)
  const ruleActions = parseSemanticActions(instruction, log);
  if (ruleActions.length > 0) {
    log.info("PARSER_FALLBACK", `Rule-based matched ${ruleActions.length} action(s): ${ruleActions.map((a) => a.type).join(", ")}`);
    return ruleActions;
  }

  // 2. LLM fallback (slow path — only when rules fail)
  log.info("PARSER_FALLBACK", `No rule match — trying LLM (qwen3:7b)`);
  try {
    const systemPrompt = buildLLMSystemPrompt();
    const llmResponse = await chatWithOllamaJSON<unknown>(
      systemPrompt,
      instruction,
      { model: "qwen3:7b", temperature: 0.1, log, onTokens }
    );

    log.info("PARSER_FALLBACK", `LLM raw response received`);

    if (!llmResponse || typeof llmResponse !== "object") {
      log.warn("PARSER_FALLBACK", `LLM returned non-object: ${JSON.stringify(llmResponse).slice(0, 200)}`);
      return [];
    }

    // Support both { actions: [...] } and [...] formats
    let rawActions: unknown[] = [];
    if (Array.isArray(llmResponse)) {
      rawActions = llmResponse;
    } else if (llmResponse && typeof llmResponse === "object" && "actions" in llmResponse) {
      const actionsField = (llmResponse as Record<string, unknown>).actions;
      if (Array.isArray(actionsField)) rawActions = actionsField;
    }

    log.info("PARSER_FALLBACK", `LLM returned ${rawActions.length} raw action(s)`);

    if (rawActions.length === 0) {
      return [];
    }

    // 3. Normalize field aliases (layoutId → layout, themeId → theme, etc.)
    const normalized = rawActions.map((a) => normalizeRawAction(a, log)).filter((a): a is Record<string, unknown> => a !== null);

    // 4. Validate and filter
    const validated = normalized.filter((a): a is SemanticDesignAction => isValidAction(a, log));

    // Post-LLM correction: if instruction explicitly mentions a section,
    // override LLM's section choice for set_section_variant actions
    const explicitSection = detectExplicitSection(lower);
    if (explicitSection && validated.length > 0) {
      for (const action of validated) {
        if (action.type === "set_section_variant" && action.section !== explicitSection) {
          log.warn("PARSER_CORRECT", `LLM drift: instruction mentions "${explicitSection}" but LLM targeted "${action.section}" — correcting`);
          action.section = explicitSection;
        }
      }
    }

    // Post-LLM language section+variant correction
    // If instruction contains "language"/"languages" and LLM returned
    // skills+expertise-bars, rewrite to languages+proficiency-bars
    const mentionsLanguage = /\b(lang(?:uage)?[s]?)\b/.test(lower);
    if (mentionsLanguage && validated.length > 0) {
      for (const action of validated) {
        if (action.type === "set_section_variant" && action.section === "skills" && action.variant === "expertise-bars") {
          log.warn("PARSER_CORRECT", `Language intent detected but LLM targeted skills with expertise-bars → rewriting to languages+proficiency-bars`);
          action.section = "languages";
          action.variant = "proficiency-bars";
        }
      }
    }

    // Post-LLM variant normalization
    for (const action of validated) {
      if (action.type === "set_section_variant") {
        action.variant = normalizeVariant(action.variant, action.section);
      }
    }

    // Post-LLM theme constraint validation
    const themeConstraints = extractThemeConstraints(lower);
    log.info("PARSER_THEME", `Extracted constraints: light=${themeConstraints.wantsLight}, dark=${themeConstraints.wantsDark}, colorful=${themeConstraints.wantsColorful}, minimal=${themeConstraints.wantsMinimal}, corporate=${themeConstraints.wantsCorporate}`);
    for (const action of validated) {
      if (action.type === "set_theme") {
        const originalTheme = action.theme;
        action.theme = correctThemeByConstraints(action.theme, themeConstraints, log);
        if (action.theme !== originalTheme) {
          log.info("PARSER_THEME", `Corrected theme: "${originalTheme}" → "${action.theme}" (constraints: light=${themeConstraints.wantsLight}, dark=${themeConstraints.wantsDark}, colorful=${themeConstraints.wantsColorful})`);
        } else {
          log.info("PARSER_THEME", `LLM theme "${action.theme}" validated OK against constraints`);
        }
      }
    }

    if (validated.length > 0) {
      log.info("PARSER_FALLBACK", `Validated ${validated.length} action(s): ${validated.map((a) => a.type).join(", ")}`);
    } else {
      log.warn("PARSER_FALLBACK", `All ${rawActions.length} raw action(s) discarded after validation`);
    }
    return validated;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("PARSER_FALLBACK", `LLM failed: ${msg}`);
    return [];
  }
}

/** Build the system prompt for the LLM fallback. */
function buildLLMSystemPrompt(): string {
  return `${SEMANTIC_DESIGN_SCHEMA}\n\n` +
    `CRITICAL RULES:\n` +
    `- Return ONLY a JSON object: { "actions": [ { "type": "...", ... }, ... ] }\n` +
    `- layout changes ONLY for explicit structural requests (e.g. "sidebar", "two-column")\n` +
    `- theme/color/style requests must NOT emit set_layout\n` +
    `- "cyberpunk", "dark", "elegant", "modern", "minimal" are theme or semantic-state changes, NOT layout changes\n` +
    `- timeline is a section variant, not a layout\n` +
    `- If no actions apply, return { "actions": [] }\n` +
    `- NEVER return CSS, HTML, font names, hex colors, or pixel values`;
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZATION — field aliases and value formats
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalize a raw action from the LLM.
 *
 * Handles field aliases:
 *   layoutId → layout
 *   themeId  → theme
 *   targetArea / destinationArea → area
 *   sectionName / targetSection → section
 *   beforeSection → reference (with position "before")
 *   afterSection  → reference (with position "after")
 *
 * Normalizes values:
 *   "right-sidebar", "sidebar_right" → "sidebar-right"
 *   "left-sidebar" → "sidebar-left"
 *   "single_column" → "single-column"
 */
function normalizeRawAction(raw: unknown, log: Logger): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const a = { ...(raw as Record<string, unknown>) };

  // Normalize action type aliases
  if (a.type === "set_emphasis") {
    log.info("PARSER_NORMALIZE", `action type: "set_emphasis" → "set_emphasis_style"`);
    a.type = "set_emphasis_style";
    // Map legacy field names to emphasisStyle
    if (a.value && !a.emphasisStyle) { a.emphasisStyle = a.value; delete a.value; }
    if (a.emphasis && !a.emphasisStyle) { a.emphasisStyle = a.emphasis; delete a.emphasis; }
    if (a.style && !a.emphasisStyle) { a.emphasisStyle = a.style; delete a.style; }
  }

  // Normalize field aliases
  if (a.layoutId && !a.layout) { a.layout = a.layoutId; delete a.layoutId; }
  if (a.themeId && !a.theme) { a.theme = a.themeId; delete a.themeId; }
  if (a.targetArea && !a.area) { a.area = a.targetArea; delete a.targetArea; }
  if (a.destinationArea && !a.area) { a.area = a.destinationArea; delete a.destinationArea; }
  if (a.sectionName && !a.section) { a.section = a.sectionName; delete a.sectionName; }
  if (a.targetSection && !a.section) { a.section = a.targetSection; delete a.targetSection; }
  if (a.beforeSection && !a.reference) { a.reference = a.beforeSection; a.position = "before"; delete a.beforeSection; }
  if (a.afterSection && !a.reference) { a.reference = a.afterSection; a.position = "after"; delete a.afterSection; }

  // Normalize layout value formats
  const layout = a.layout;
  if (typeof layout === "string") {
    const normalizedLayout = layout
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase();
    if (normalizedLayout !== layout) {
      log.info("PARSER_NORMALIZE", `layout: "${layout}" → "${normalizedLayout}"`);
      a.layout = normalizedLayout;
    }
  }

  // Normalize theme value formats
  const theme = a.theme;
  if (typeof theme === "string") {
    const normalizedTheme = theme
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .toLowerCase();
    if (normalizedTheme !== theme) {
      log.info("PARSER_NORMALIZE", `theme: "${theme}" → "${normalizedTheme}"`);
      a.theme = normalizedTheme;
    }
  }

  return a;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION — strict filtering of LLM output
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate a single action from LLM output.
 *
 * Discards:
 *   - non-objects
 *   - unknown action types
 *   - actions with invalid layout/theme values
 *   - actions containing CSS/HTML strings
 */
function isValidAction(action: unknown, log: Logger): action is SemanticDesignAction {
  if (!action || typeof action !== "object") return false;
  const a = action as Record<string, unknown>;

  // Must have a type
  const type = a.type;
  if (typeof type !== "string") {
    log.warn("PARSER_VALIDATE", `Discarding action with missing/invalid type`);
    return false;
  }

  // Type must be known
  if (!VALID_ACTION_TYPES.has(type)) {
    log.warn("PARSER_VALIDATE", `Discarding unknown action type: "${type}"`);
    return false;
  }

  // Validate value fields don't contain CSS/HTML
  for (const [key, val] of Object.entries(a)) {
    if (typeof val === "string" && containsForbiddenContent(val)) {
      log.warn("PARSER_VALIDATE", `Discarding action "${type}" — field "${key}" contains forbidden content: "${val.slice(0, 40)}"`);
      return false;
    }
  }

  // Type-specific validation
  switch (type) {
    case "set_layout": {
      const layout = a.layout;
      if (typeof layout !== "string" || !VALID_LAYOUTS.has(layout)) {
        log.warn("PARSER_VALIDATE", `Discarding set_layout — invalid layout: "${layout}" (valid: ${Array.from(VALID_LAYOUTS).join(", ")})`);
        return false;
      }
      break;
    }
    case "set_theme": {
      const theme = a.theme;
      if (typeof theme !== "string" || !VALID_THEMES.has(theme)) {
        log.warn("PARSER_VALIDATE", `Discarding set_theme — invalid theme: "${theme}"`);
        return false;
      }
      break;
    }
    case "move_section": {
      const section = a.section;
      const position = a.position;
      if (typeof section !== "string" || typeof position !== "string") {
        log.warn("PARSER_VALIDATE", `Discarding move_section — missing section or position`);
        return false;
      }
      break;
    }
    case "move_section_to_area": {
      const area = a.area;
      if (area !== "main" && area !== "sidebar") {
        log.warn("PARSER_VALIDATE", `Discarding move_section_to_area — invalid area: "${area}"`);
        return false;
      }
      break;
    }
    case "set_emphasis_style": {
      const emphasisStyle = a.emphasisStyle;
      if (typeof emphasisStyle !== "string" || !VALID_EMPHASIS_STYLES.has(emphasisStyle)) {
        log.warn("PARSER_VALIDATE", `Discarding set_emphasis_style — invalid emphasisStyle: "${emphasisStyle}" (valid: ${Array.from(VALID_EMPHASIS_STYLES).join(", ")})`);
        return false;
      }
      break;
    }
    case "set_section_variant": {
      const section = a.section as string;
      const variant = a.variant as string;
      if (typeof section !== "string" || typeof variant !== "string") {
        log.warn("PARSER_VALIDATE", `Discarding set_section_variant — missing section or variant`);
        return false;
      }
      // Validate: variant must be allowed for this section type
      const allowlist = SECTION_VARIANT_ALLOWLIST[section];
      if (allowlist && !allowlist.has(variant)) {
        // Skills-only variant on non-skills section → reject
        if (SKILLS_VARIANTS.has(variant) && section !== "skills") {
          log.warn("PARSER_VALIDATE", `Discarding set_section_variant — skills variant "${variant}" not allowed for "${section}"`);
          return false;
        }
        // Languages-only variant on non-languages section → reject
        if (LANGUAGES_VARIANTS.has(variant) && section !== "languages") {
          log.warn("PARSER_VALIDATE", `Discarding set_section_variant — languages variant "${variant}" not allowed for "${section}"`);
          return false;
        }
        // Unknown variant for this section → reject
        log.warn("PARSER_VALIDATE", `Discarding set_section_variant — unknown variant "${variant}" for "${section}"`);
        return false;
      }
      break;
    }
    case "set_skill_level": {
      const skill = a.skill;
      const level = typeof a.level === "number" ? a.level : parseFloat(a.level as string);
      if (typeof skill !== "string" || Number.isNaN(level)) {
        log.warn("PARSER_VALIDATE", `Discarding set_skill_level — missing skill or invalid level`);
        return false;
      }
      break;
    }
    case "set_all_skill_levels": {
      const level = typeof a.level === "number" ? a.level : parseFloat(a.level as string);
      if (Number.isNaN(level)) {
        log.warn("PARSER_VALIDATE", `Discarding set_all_skill_levels — invalid level`);
        return false;
      }
      break;
    }
    case "set_language_level": {
      const language = a.language;
      const level = typeof a.level === "number" ? a.level : parseFloat(a.level as string);
      if (typeof language !== "string" || Number.isNaN(level)) {
        log.warn("PARSER_VALIDATE", `Discarding set_language_level — missing language or invalid level`);
        return false;
      }
      break;
    }
    case "set_language_proficiency": {
      const language = a.language;
      const proficiency = a.proficiency;
      if (typeof language !== "string" || typeof proficiency !== "string") {
        log.warn("PARSER_VALIDATE", `Discarding set_language_proficiency — missing language or proficiency`);
        return false;
      }
      break;
    }
    case "set_tone":
    case "set_density":
    case "set_color_mood":
    case "set_visual_balance": {
      const value = a.value;
      if (typeof value !== "string") {
        log.warn("PARSER_VALIDATE", `Discarding ${type} — invalid value: "${value}"`);
        return false;
      }
      break;
    }
    case "apply_preset": {
      const preset = a.preset;
      if (typeof preset !== "string") {
        log.warn("PARSER_VALIDATE", `Discarding apply_preset — invalid preset: "${preset}"`);
        return false;
      }
      break;
    }
  }

  return true;
}

/** Check if a string contains CSS, HTML, or other forbidden content. */
function containsForbiddenContent(val: string): boolean {
  // Block CSS-like content: { }, ;, < >, # (hex colors)
  const hasCSS = /[{;}]/.test(val);
  const hasHTML = /<[^>]+>/.test(val);
  const hasHexColor = /#[0-9a-fA-F]{3,8}\b/.test(val);
  return hasCSS || hasHTML || hasHexColor;
}
