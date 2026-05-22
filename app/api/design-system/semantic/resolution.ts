/**
 * Design System — Semantic Resolution Engine
 *
 * Converts a DesignComposition into a concrete DesignState.
 * Uses the layout + theme registries. No template concepts.
 */

import type { Logger } from "../../infrastructure/logging/logger";
import type { DesignComposition } from "../composition";
import type { DesignState } from "../rendering/types";
import { getLayout } from "../layouts/registry";
import { getTheme } from "../themes/registry";

/**
 * Resolve a DesignComposition into a concrete DesignState.
 *
 * This is the bridge between semantic intent (DesignComposition)
 * and concrete rendering values (DesignState).
 */
export function resolveDesignState(
  composition: DesignComposition,
  log: Logger
): DesignState {
  const layout = getLayout(composition.layoutId);
  const theme = getTheme(composition.themeId);
  const semanticState = composition.semanticState;

  log.info("RESOLVE", `Resolving: layout="${composition.layoutId}" theme="${composition.themeId}" tone="${semanticState.tone}" density="${semanticState.density}"`);

  // Build section order from composition.sectionLayout
  const sectionOrder = buildSectionOrder(composition);

  const state: DesignState = {
    layoutId: composition.layoutId,
    themeId: composition.themeId,
    colors: { ...theme.colors },
    typography: { ...theme.typography },
    decorations: { ...theme.decorations },
    layout: {
      sectionOrder,
      spacing: theme.spacing,
      columnOverrides: {},
    },
  };

  // Apply density adjustments
  if (semanticState.density === "compact") {
    state.layout.spacing = "compact";
  } else if (semanticState.density === "spacious") {
    state.layout.spacing = "spacious";
  }

  // Apply color mood
  if (semanticState.colorMood === "bold") {
    state.colors.accent = adjustBrightness(state.colors.accent, 1.2);
  } else if (semanticState.colorMood === "muted") {
    state.colors.accent = desaturate(state.colors.accent, 0.5);
  }

  // Apply conflict resolution
  const finalState = resolveSemanticConflicts(state, log);

  log.info("RESOLVE", `Resolved: primary=${finalState.colors.primary} font=${finalState.typography.fontFamily} spacing=${finalState.layout.spacing}`);

  return finalState;
}

/** Build section order from composition.sectionLayout */
function buildSectionOrder(composition: DesignComposition): string[] {
  const { sectionLayout } = composition;

  // Interleave: main sections in order, with sidebar sections at appropriate positions
  // Strategy: sidebar sections first (they appear in sidebar), then main sections
  // The actual renderer uses sectionLayout.main and sectionLayout.sidebar separately
  // but the sectionOrder controls overall document flow
  const order: string[] = [];

  // Add all main sections
  for (const section of sectionLayout.main) {
    if (!order.includes(section)) order.push(section);
  }

  // Add any sidebar sections not already in the order
  if (sectionLayout.sidebar) {
    for (const section of sectionLayout.sidebar) {
      if (!order.includes(section)) order.push(section);
    }
  }

  return order;
}

/** Resolve semantic conflicts in a concrete DesignState (e.g. compact spacing + giant name) */
export function resolveSemanticConflicts(state: DesignState, log: Logger): DesignState {
  const s = { ...state, colors: { ...state.colors }, typography: { ...state.typography }, layout: { ...state.layout } };

  if (s.layout.spacing === "compact" && s.typography.nameSizePt > 28) {
    log.info("CONFLICT", "Compact spacing + large name → reducing nameSizePt to 28");
    s.typography.nameSizePt = 28;
  }

  return s;
}

// ── Color helpers ──

function adjustBrightness(hex: string, factor: number): string {
  try {
    const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * factor));
    const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * factor));
    const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * factor));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch {
    return hex;
  }
}

function desaturate(hex: string, factor: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const gray = (r + g + b) / 3;
    const nr = Math.round(r * (1 - factor) + gray * factor);
    const ng = Math.round(g * (1 - factor) + gray * factor);
    const nb = Math.round(b * (1 - factor) + gray * factor);
    return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
  } catch {
    return hex;
  }
}
