/**
 * Design System — Semantic Actions
 * The ONLY output the LLM is allowed to produce.
 *
 * Three independent families:
 *   1. SemanticStyleAction  → aesthetic intent
 *   2. StructuralAction     → spatial changes
 *   3. RenderingOverride    → explicit rendering overrides
 *
 * Canonical reducer:
 *   applySemanticActionsToComposition(currentComposition, actions, log) → updated DesignComposition
 *
 * The reducer starts from the CURRENT composition and mutates ONLY the fields
 * affected by the actions. Layout and theme are preserved unless explicitly changed.
 */

import type { Logger } from "../../infrastructure/logging/logger";
import type { SemanticDesignState } from "./state";
import { resolveSemanticConflicts } from "./resolution";
import { DESIGN_PRESETS } from "./presets";
import type { DesignComposition, RenderingOverride } from "../composition";
import type { LayoutId } from "../layouts/registry";
import type { ThemeId } from "../themes/registry";

// ═══════════════════════════════════════════════════════════════════════════
// ACTION TYPE FAMILIES
// ═══════════════════════════════════════════════════════════════════════════

/** SemanticStyleAction — purely AESTHETIC intent. Never changes layout/theme. */
export type SemanticStyleAction =
  | { type: "set_tone"; value: SemanticDesignState["tone"] }
  | { type: "set_density"; value: SemanticDesignState["density"] }
  | { type: "set_emphasis"; section: string; value: SemanticDesignState["hierarchy"] extends Record<string, infer V> ? V : never }
  | { type: "set_visual_balance"; value: SemanticDesignState["layoutPreference"]["visualBalance"] }
  | { type: "set_emphasis_style"; value: SemanticDesignState["emphasisStyle"] }
  | { type: "set_color_mood"; value: SemanticDesignState["colorMood"] }
  | { type: "apply_preset"; preset: string };

/** StructuralAction — purely SPATIAL/STRUCTURAL intent. */
export type StructuralAction =
  | { type: "set_layout"; layout: LayoutId }
  | { type: "set_theme"; theme: ThemeId }
  | { type: "set_columns"; value: SemanticDesignState["layoutPreference"]["columns"] }
  | { type: "move_section"; section: string; position: string; reference?: string }
  | { type: "move_section_to_area"; section: string; area: "main" | "sidebar" }
  | { type: "set_section_variant"; section: string; variant: string }
  | { type: "set_skill_level"; skill: string; level: number }
  | { type: "set_all_skill_levels"; level: number }
  | { type: "set_language_level"; language: string; level: number }
  | { type: "set_language_proficiency"; language: string; proficiency: string };

/** RenderingOverrideAction — explicit rendering overrides (NOT semantic). */
export type RenderingOverrideAction =
  | { type: "set_font_size"; target: "base" | "heading" | "name"; valuePt: number };

export type SemanticDesignAction =
  | SemanticStyleAction
  | StructuralAction
  | RenderingOverrideAction;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

export function isSemanticStyleAction(a: SemanticDesignAction): a is SemanticStyleAction {
  return ["set_tone", "set_density", "set_emphasis", "set_visual_balance", "set_emphasis_style", "set_color_mood", "apply_preset"].includes(a.type);
}

export function isStructuralAction(a: SemanticDesignAction): a is StructuralAction {
  return ["set_layout", "set_theme", "set_columns", "move_section", "move_section_to_area", "set_section_variant", "set_skill_level", "set_all_skill_levels", "set_language_level", "set_language_proficiency"].includes(a.type);
}

export function isRenderingOverride(a: SemanticDesignAction): a is RenderingOverrideAction {
  return a.type === "set_font_size";
}

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL REDUCER: operates on full DesignComposition
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Apply semantic actions to a DesignComposition.
 *
 * CRITICAL: Starts from currentComposition. Preserves layout/theme/sections
 * unless an action EXPLICITLY changes them. Never resets to defaults.
 */
export function applySemanticActionsToComposition(
  currentComposition: DesignComposition,
  actions: SemanticDesignAction[],
  log: Logger
): DesignComposition {
  // Deep-clone to avoid mutation — ALL fields must be copied
  const composition: DesignComposition = {
    layoutId: currentComposition.layoutId,
    themeId: currentComposition.themeId,
    semanticState: { ...currentComposition.semanticState, hierarchy: { ...currentComposition.semanticState.hierarchy }, layoutPreference: { ...currentComposition.semanticState.layoutPreference } },
    sectionLayout: {
      main: [...currentComposition.sectionLayout.main],
      sidebar: currentComposition.sectionLayout.sidebar ? [...currentComposition.sectionLayout.sidebar] : undefined,
    },
    sectionVariants: { ...currentComposition.sectionVariants },
    sectionDataOverrides: deepCloneSectionDataOverrides(currentComposition.sectionDataOverrides),
    renderingOverrides: [...currentComposition.renderingOverrides],
  };

  for (const action of actions) {
    if (isSemanticStyleAction(action)) {
      reduceStyleAction(composition.semanticState, action, log);
    } else if (isStructuralAction(action)) {
      reduceStructuralAction(composition, action, log);
    } else if (isRenderingOverride(action)) {
      reduceRenderingOverride(composition, action, log);
    }
  }

  // Resolve any conflicts in the semantic state
  composition.semanticState = resolveSemanticConflicts(composition.semanticState, log);

  return composition;
}

// ── Style Actions ──

function reduceStyleAction(
  state: SemanticDesignState,
  action: SemanticStyleAction,
  log: Logger
): void {
  switch (action.type) {
    case "set_tone": state.tone = action.value; log.info("SEMANTIC", `set_tone → ${action.value}`); break;
    case "set_density": state.density = action.value; log.info("SEMANTIC", `set_density → ${action.value}`); break;
    case "set_emphasis": state.hierarchy = { ...state.hierarchy, [action.section]: action.value }; log.info("SEMANTIC", `set_emphasis → ${action.section}=${action.value}`); break;
    case "set_visual_balance": state.layoutPreference = { ...state.layoutPreference, visualBalance: action.value }; log.info("SEMANTIC", `set_visual_balance → ${action.value}`); break;
    case "set_emphasis_style": state.emphasisStyle = action.value; log.info("SEMANTIC", `set_emphasis_style → ${action.value}`); break;
    case "set_color_mood": state.colorMood = action.value; log.info("SEMANTIC", `set_color_mood → ${action.value}`); break;
    case "apply_preset": {
      const preset = DESIGN_PRESETS[action.preset.toLowerCase()];
      if (preset) { Object.assign(state, preset); log.info("SEMANTIC", `apply_preset "${action.preset}"`); }
      else { log.warn("SEMANTIC", `Unknown preset: "${action.preset}"`); }
      break;
    }
  }
}

// ── Structural Actions ──

function reduceStructuralAction(
  composition: DesignComposition,
  action: StructuralAction,
  log: Logger
): void {
  switch (action.type) {
    case "set_layout":
      composition.layoutId = action.layout;
      log.info("SEMANTIC", `set_layout → ${action.layout}`);
      break;
    case "set_theme":
      composition.themeId = action.theme;
      log.info("SEMANTIC", `set_theme → ${action.theme}`);
      break;
    case "set_columns":
      composition.semanticState.layoutPreference = { ...composition.semanticState.layoutPreference, columns: action.value };
      log.info("SEMANTIC", `set_columns → ${action.value}`);
      break;
    case "move_section": {
      const reordered = moveSectionInLayout(composition.sectionLayout, action.section, action.position, action.reference);
      if (reordered) {
        composition.sectionLayout = reordered;
        log.info("SEMANTIC", `move_section → ${action.section} ${action.position}${action.reference ? " " + action.reference : ""}`);
      } else {
        log.warn("SEMANTIC", `move_section failed → ${action.section} not found`);
      }
      break;
    }
    case "move_section_to_area": {
      composition.sectionLayout = moveSectionToArea(composition.sectionLayout, action.section, action.area);
      log.info("SEMANTIC", `move_section_to_area → ${action.section} → ${action.area}`);
      break;
    }
    case "set_section_variant": {
      composition.sectionVariants = { ...composition.sectionVariants, [action.section]: action.variant };
      log.info("SEMANTIC", `set_section_variant → ${action.section}=${action.variant}`);
      break;
    }
    case "set_skill_level": {
      composition.sectionDataOverrides = {
        ...composition.sectionDataOverrides,
        skills: {
          ...composition.sectionDataOverrides.skills,
          levels: {
            ...composition.sectionDataOverrides.skills?.levels,
            [action.skill]: clamp(action.level, 0, 100),
          },
        },
      };
      composition.sectionVariants = { ...composition.sectionVariants, skills: "expertise-bars" };
      log.info("SEMANTIC", `set_skill_level → ${action.skill}=${clamp(action.level, 0, 100)}%`);
      break;
    }
    case "set_all_skill_levels": {
      composition.sectionDataOverrides = {
        ...composition.sectionDataOverrides,
        skills: {
          ...composition.sectionDataOverrides.skills,
          levels: {
            ...composition.sectionDataOverrides.skills?.levels,
            // Default ALL skills to the requested level (100 for full bars)
            _default: clamp(action.level, 0, 100),
          },
        },
      };
      composition.sectionVariants = { ...composition.sectionVariants, skills: "expertise-bars" };
      log.info("SEMANTIC", `set_all_skill_levels → default=${clamp(action.level, 0, 100)}%`);
      break;
    }
    case "set_language_level": {
      composition.sectionDataOverrides = {
        ...composition.sectionDataOverrides,
        languages: {
          ...composition.sectionDataOverrides.languages,
          levels: {
            ...composition.sectionDataOverrides.languages?.levels,
            [action.language]: clamp(action.level, 0, 100),
          },
        },
      };
      composition.sectionVariants = { ...composition.sectionVariants, languages: "proficiency-bars" };
      log.info("SEMANTIC", `set_language_level → ${action.language}=${clamp(action.level, 0, 100)}%`);
      break;
    }
    case "set_language_proficiency": {
      composition.sectionDataOverrides = {
        ...composition.sectionDataOverrides,
        languages: {
          ...composition.sectionDataOverrides.languages,
          proficiencies: {
            ...composition.sectionDataOverrides.languages?.proficiencies,
            [action.language]: action.proficiency,
          },
        },
      };
      // Preserve proficiency-bars if already active — only switch to list if explicit
      const currentLangVariant = composition.sectionVariants.languages;
      if (currentLangVariant !== "proficiency-bars") {
        composition.sectionVariants = { ...composition.sectionVariants, languages: "proficiency-list" };
      }
      log.info("SEMANTIC", `set_language_proficiency → ${action.language}=${action.proficiency} (variant: ${currentLangVariant ?? "default"})`);
      break;
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Deep-clone sectionDataOverrides to preserve skill levels and language proficiencies */
function deepCloneSectionDataOverrides(o: DesignComposition["sectionDataOverrides"]): DesignComposition["sectionDataOverrides"] {
  if (!o || Object.keys(o).length === 0) return {};
  const clone: DesignComposition["sectionDataOverrides"] = {};
  if (o.skills) {
    clone.skills = { levels: o.skills.levels ? { ...o.skills.levels } : {} };
  }
  if (o.languages) {
    clone.languages = {
      levels: o.languages.levels ? { ...o.languages.levels } : {},
      proficiencies: o.languages.proficiencies ? { ...o.languages.proficiencies } : {},
    };
  }
  return clone;
}

// ── Rendering Overrides ──

function reduceRenderingOverride(
  composition: DesignComposition,
  action: RenderingOverrideAction,
  log: Logger
): void {
  composition.renderingOverrides.push({
    target: "fontSize",
    value: { target: action.target, pt: action.valuePt },
  });
  log.info("SEMANTIC", `set_font_size → ${action.target}=${action.valuePt}pt`);
}

// ── move_section helper ──

function moveSectionInLayout(
  layout: DesignComposition["sectionLayout"],
  section: string,
  position: string,
  reference?: string
): DesignComposition["sectionLayout"] | undefined {
  // Find where the section currently lives
  const inMain = layout.main.indexOf(section);
  const inSidebar = layout.sidebar?.indexOf(section) ?? -1;

  if (inMain < 0 && inSidebar < 0) return undefined;

  // Remove from current location
  const next: DesignComposition["sectionLayout"] = {
    main: [...layout.main],
    sidebar: layout.sidebar ? [...layout.sidebar] : undefined,
  };

  if (inMain >= 0) next.main.splice(inMain, 1);
  else if (inSidebar >= 0) next.sidebar!.splice(inSidebar, 1);

  // Determine destination
  const lowerPos = position.toLowerCase().trim();

  // Top/bottom of main
  if (lowerPos === "top" || lowerPos === "first") {
    next.main.unshift(section);
    return next;
  }
  if (lowerPos === "bottom" || lowerPos === "last") {
    next.main.push(section);
    return next;
  }

  // Before/after a reference section
  const ref = reference || lowerPos.replace(/^(before|after):/, "").trim();
  if (!ref) return undefined;

  // Try to find reference in main first
  const refInMain = next.main.indexOf(ref);
  if (refInMain >= 0) {
    const insertIdx = lowerPos.startsWith("before") || lowerPos === "above"
      ? refInMain
      : refInMain + 1;
    next.main.splice(insertIdx, 0, section);
    return next;
  }

  // Try sidebar
  if (next.sidebar) {
    const refInSidebar = next.sidebar.indexOf(ref);
    if (refInSidebar >= 0) {
      const insertIdx = lowerPos.startsWith("before") || lowerPos === "above"
        ? refInSidebar
        : refInSidebar + 1;
      next.sidebar.splice(insertIdx, 0, section);
      return next;
    }
  }

  return undefined;
}

/** Move a section between main and sidebar areas */
function moveSectionToArea(
  layout: DesignComposition["sectionLayout"],
  section: string,
  area: "main" | "sidebar"
): DesignComposition["sectionLayout"] {
  const next: DesignComposition["sectionLayout"] = {
    main: [...layout.main],
    sidebar: layout.sidebar ? [...layout.sidebar] : [],
  };

  // Remove from current location
  const inMain = next.main.indexOf(section);
  const inSidebar = next.sidebar!.indexOf(section);

  if (inMain >= 0) next.main.splice(inMain, 1);
  if (inSidebar >= 0) next.sidebar!.splice(inSidebar, 1);

  // Add to destination
  if (area === "main" && !next.main.includes(section)) {
    next.main.push(section);
  } else if (area === "sidebar" && !next.sidebar!.includes(section)) {
    next.sidebar!.push(section);
  }

  return next;
}
