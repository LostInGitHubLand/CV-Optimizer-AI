/**
 * Design System — Design Composition
 *
 * The ONLY runtime source of truth for visual state.
 *
 * DesignComposition = WHAT the user wants (semantic + structural choices)
 * DesignState       = HOW it renders (concrete rendering values)
 *
 * Canonical flow:
 *   JsonCv → inferInitialComposition() → DesignComposition
 *   DesignComposition + SemanticActions → applySemanticActionsToComposition() → updated DesignComposition
 *   DesignComposition → resolveDesignState() → DesignState
 *   DesignState → renderSemanticHtml() → HTML
 *
 * NO template concepts. NO template IDs. NO legacy mappings.
 */

import type { LayoutId } from "./layouts/registry";
import { LAYOUTS, getLayout, inferLayoutFromDomain } from "./layouts/registry";
import type { ThemeId } from "./themes/registry";
import { inferThemeFromDomain } from "./themes/registry";
import type { SemanticDesignState, Tone, Density, EmphasisStyle, ColorMood, VisualBalance } from "./semantic/state";
import { DEFAULT_SEMANTIC_STATE } from "./semantic/state";
import type { RenderingOverrideAction } from "./semantic/actions";
import type { JsonCv } from "../agents/writer";
import type { Logger } from "../infrastructure/logging/logger";

/** Per-section rendering variant (e.g. "timeline", "compact", "cards") */
export type SectionVariant = string;

/** Rendering override — explicit low-level tweak, NOT semantic intent */
export interface RenderingOverride {
  target: "fontSize" | "color" | "spacing";
  section?: string;
  value: unknown;
}

/** Per-section data overrides: skill levels, language proficiencies, etc. */
export interface SectionDataOverrides {
  skills?: {
    levels?: Record<string, number>;
  };
  languages?: {
    levels?: Record<string, number>;
    proficiencies?: Record<string, string>;
  };
}

/**
 * The canonical composition model. SINGLE source of truth.
 * Captures ALL user intent before resolution to concrete rendering values.
 */
export interface DesignComposition {
  layoutId: LayoutId;
  themeId: ThemeId;

  semanticState: SemanticDesignState;

  /** Which sections go where */
  sectionLayout: {
    main: string[];
    sidebar?: string[];
  };

  /** Per-section rendering variants */
  sectionVariants: Record<string, SectionVariant>;

  /** Per-section data overrides: skill levels, language proficiencies, etc. */
  sectionDataOverrides: SectionDataOverrides;

  /** Low-level rendering overrides (font sizes, colors, spacing tweaks) */
  renderingOverrides: RenderingOverride[];
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

export function createDefaultComposition(layoutId: LayoutId = "single-column", themeId: ThemeId = "minimal-swiss"): DesignComposition {
  const layout = getLayout(layoutId);
  return {
    layoutId,
    themeId,
    semanticState: { ...DEFAULT_SEMANTIC_STATE },
    sectionLayout: {
      main: [...layout.mainSections],
      sidebar: layout.sidebarPosition !== "none" ? [...layout.sidebarSections] : undefined,
    },
    sectionVariants: {},
    sectionDataOverrides: {},
    renderingOverrides: [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

export function serializeDesignComposition(composition: DesignComposition): string {
  return JSON.stringify(composition);
}

export function deserializeDesignComposition(raw: string | null | undefined): DesignComposition | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DesignComposition>;
    if (!parsed || typeof parsed !== "object") return null;

    const layoutId = (parsed.layoutId || "single-column") as LayoutId;
    const themeId = (parsed.themeId || "minimal-swiss") as ThemeId;
    const defaults = createDefaultComposition(layoutId, themeId);

    if (parsed.semanticState) {
      defaults.semanticState = { ...defaults.semanticState, ...parsed.semanticState };
    }
    if (parsed.sectionLayout) {
      defaults.sectionLayout = {
        main: parsed.sectionLayout.main || defaults.sectionLayout.main,
        sidebar: parsed.sectionLayout.sidebar,
      };
    }
    if (parsed.sectionVariants) {
      defaults.sectionVariants = { ...parsed.sectionVariants };
    }
    if (parsed.sectionDataOverrides) {
      defaults.sectionDataOverrides = { ...parsed.sectionDataOverrides };
    }
    if (parsed.renderingOverrides) {
      defaults.renderingOverrides = parsed.renderingOverrides as RenderingOverride[];
    }

    return defaults;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL COMPOSITION INFERENCE
// ═══════════════════════════════════════════════════════════════════════════

interface CvAnalysis {
  domain: string;
  sectionCount: number;
  entryCount: number;
  hasTechnicalSkills: boolean;
  techSkillCount: number;
  hasPublications: boolean;
  publicationCount: number;
  hasProjects: boolean;
  projectCount: number;
  hasCertifications: boolean;
  certCount: number;
  seniority: "entry" | "mid" | "senior" | "executive";
  documentDensity: "sparse" | "moderate" | "dense";
  sectionTypes: string[];
}

/**
 * Infer the optimal DesignComposition from a CV JSON.
 * PRIMARY entry point for initial rendering.
 */
export function inferInitialComposition(cv: JsonCv, domain: string, log: Logger): DesignComposition {
  const analysis = analyzeCvContent(cv, domain);
  log.info("COMPOSITION", `CV analysis: sections=${analysis.sectionCount}, entries=${analysis.entryCount}, seniority=${analysis.seniority}, density=${analysis.documentDensity}`);

  const layoutId = inferLayoutFromDomain(analysis.domain);
  const themeId = inferThemeFromDomain(analysis.domain);
  const semanticState = inferSemanticState(analysis, log);

  const layout = getLayout(layoutId);

  log.info("COMPOSITION", `Inferred: layout="${layoutId}" theme="${themeId}" tone="${semanticState.tone}" density="${semanticState.density}"`);

  return {
    layoutId,
    themeId,
    semanticState,
    sectionLayout: {
      main: [...layout.mainSections],
      sidebar: layout.sidebarPosition !== "none" ? [...layout.sidebarSections] : undefined,
    },
    sectionVariants: {},
    sectionDataOverrides: {},
    renderingOverrides: [],
  };
}

// ── Analysis ──

function analyzeCvContent(cv: JsonCv, domain: string): CvAnalysis {
  const sections = cv.sections || [];
  const sectionTypes = sections.map((s) => s.type);
  const entryCount = sections.reduce((sum, s) => sum + (s.entries?.length || 0), 0);

  const skillsSection = sections.find((s) => s.type === "skills");
  const techSkillCount = skillsSection?.entries?.length || 0;

  const publications = sections.find((s) => s.type === "publications");
  const projects = sections.find((s) => s.type === "projects");
  const certs = sections.find((s) => s.type === "certifications");

  const experience = sections.find((s) => s.type === "experience");
  const expEntries = experience?.entries || [];
  const totalYears = expEntries.reduce((sum, e) => {
    const date = e.date || "";
    const match = date.match(/(\d{4})/g);
    if (match && match.length >= 2) {
      const start = parseInt(match[0], 10);
      const end = parseInt(match[match.length - 1], 10);
      return sum + (end - start);
    }
    return sum;
  }, 0);

  let seniority: CvAnalysis["seniority"] = "entry";
  if (totalYears > 15 || expEntries.length > 6) seniority = "executive";
  else if (totalYears > 8 || expEntries.length > 4) seniority = "senior";
  else if (totalYears > 3 || expEntries.length > 2) seniority = "mid";

  let documentDensity: CvAnalysis["documentDensity"] = "moderate";
  if (entryCount > 25 || sections.length > 8) documentDensity = "dense";
  else if (entryCount < 10 || sections.length < 5) documentDensity = "sparse";

  return {
    domain,
    sectionCount: sections.length,
    entryCount,
    hasTechnicalSkills: techSkillCount > 5,
    techSkillCount,
    hasPublications: (publications?.entries?.length || 0) > 0,
    publicationCount: publications?.entries?.length || 0,
    hasProjects: (projects?.entries?.length || 0) > 0,
    projectCount: projects?.entries?.length || 0,
    hasCertifications: (certs?.entries?.length || 0) > 0,
    certCount: certs?.entries?.length || 0,
    seniority,
    documentDensity,
    sectionTypes,
  };
}

// ── Semantic state inference ──

function inferSemanticState(analysis: CvAnalysis, log: Logger): SemanticDesignState {
  let tone: Tone = "modern";
  let density: Density = "normal";
  let emphasisStyle: EmphasisStyle = "subtle";
  let colorMood: ColorMood = "neutral";
  let visualBalance: VisualBalance = "balanced";

  if (analysis.seniority === "executive") {
    tone = "elegant";
    visualBalance = "conservative";
    emphasisStyle = "strong";
  } else if (analysis.seniority === "senior") {
    tone = "corporate";
    colorMood = "professional";
  }

  if (analysis.documentDensity === "dense") density = "compact";
  else if (analysis.documentDensity === "sparse") density = "spacious";

  const d = analysis.domain.toLowerCase();
  if (d.includes("creative") || d.includes("design") || d.includes("marketing")) {
    tone = "creative";
    visualBalance = "expressive";
    emphasisStyle = "strong";
    colorMood = "bold";
  } else if (d.includes("legal") || d.includes("law")) {
    tone = "corporate";
    colorMood = "professional";
    emphasisStyle = "subtle";
  } else if (d.includes("academic") || d.includes("research") || d.includes("education")) {
    tone = "minimal";
    colorMood = "muted";
    visualBalance = "conservative";
  }

  log.info("COMPOSITION", `Semantic: tone=${tone} density=${density} emphasis=${emphasisStyle} mood=${colorMood}`);

  return {
    tone,
    density,
    hierarchy: {},
    layoutPreference: { columns: "single", visualBalance },
    emphasisStyle,
    colorMood,
  };
}
