/**
 * Design System — Semantic Presets
 *
 * Presets are SEMANTIC INTENT BUNDLES — not renderer concerns.
 * Each preset captures a complete aesthetic direction as semantic state overrides.
 *
 * Architecture:
 *   Presets live in the semantic layer.
 *   They are resolved THROUGH the theme system.
 *   They never contain: colors, fonts, pixel values, hex codes.
 *
 * Resolution chain:
 *   apply_preset "modern" → semanticState = { tone: "modern", density: "normal", ... }
 *   → resolveDesignState(layout, theme, semanticState) → concrete DesignState
 */

import type { Tone, Density, EmphasisStyle, ColorMood, VisualBalance } from "./state";

export interface SemanticPreset {
  name: string;
  description: string;
  state: {
    tone: Tone;
    density: Density;
    emphasisStyle: EmphasisStyle;
    colorMood: ColorMood;
    visualBalance: VisualBalance;
  };
}

/**
 * Named semantic presets.
 * Each describes a complete aesthetic direction.
 */
export const SEMANTIC_PRESETS: Record<string, SemanticPreset> = {
  modern: {
    name: "Modern",
    description: "Clean, professional, balanced. Suitable for most professional contexts.",
    state: { tone: "modern", density: "normal", emphasisStyle: "subtle", colorMood: "neutral", visualBalance: "balanced" },
  },
  corporate: {
    name: "Corporate",
    description: "Dense, authoritative, professional. Information-rich with conservative spacing.",
    state: { tone: "corporate", density: "compact", emphasisStyle: "subtle", colorMood: "professional", visualBalance: "conservative" },
  },
  academic: {
    name: "Academic",
    description: "Restrained, scholarly, warm neutrals. Generous margins and quiet hierarchy.",
    state: { tone: "minimal", density: "normal", emphasisStyle: "minimal", colorMood: "muted", visualBalance: "conservative" },
  },
  startup: {
    name: "Startup",
    description: "High energy, punchy, confident. Bold accents and expressive visual balance.",
    state: { tone: "creative", density: "compact", emphasisStyle: "strong", colorMood: "bold", visualBalance: "expressive" },
  },
  executive: {
    name: "Executive",
    description: "Elegant, spacious, refined. Strong hierarchy with conservative authority.",
    state: { tone: "elegant", density: "spacious", emphasisStyle: "strong", colorMood: "professional", visualBalance: "conservative" },
  },
  creative: {
    name: "Creative",
    description: "Expressive, bold, visually striking. Strong emphasis with vibrant energy.",
    state: { tone: "creative", density: "normal", emphasisStyle: "strong", colorMood: "bold", visualBalance: "expressive" },
  },
  minimal: {
    name: "Minimal",
    description: "Maximum restraint. Flat hierarchy, neutral colors, essential information only.",
    state: { tone: "minimal", density: "normal", emphasisStyle: "minimal", colorMood: "neutral", visualBalance: "balanced" },
  },
  elegant: {
    name: "Elegant",
    description: "Refined, spacious, sophisticated. Generous whitespace with subtle emphasis.",
    state: { tone: "elegant", density: "spacious", emphasisStyle: "subtle", colorMood: "muted", visualBalance: "balanced" },
  },
};

/** Backward-compatible flat state export (for existing callers) */
export const DESIGN_PRESETS: Record<string, { tone: Tone; density: Density; emphasisStyle: EmphasisStyle; colorMood: ColorMood; visualBalance: VisualBalance }> = Object.fromEntries(
  Object.entries(SEMANTIC_PRESETS).map(([k, v]) => [k, v.state])
);

/** Resolve a preset name to its semantic state */
export function resolvePreset(name: string): SemanticPreset | null {
  return SEMANTIC_PRESETS[name.toLowerCase()] || null;
}
