/**
 * Design System — Token Layer
 *
 * Intermediate abstraction between semantic intent and concrete rendering values.
 *
 * Architecture:
 *   Semantic Intent (abstract: "elegant", "compact")
 *     ↓
 *   Semantic Tokens (typed intermediates: typographyProfile, spacingProfile)
 *     ↓
 *   Rendering Tokens (concrete: fontFamily, baseSizePt, spacing)
 *     ↓
 *   Final DesignState
 *
 * Benefits:
 *   - Scalability: new themes only need token mappings
 *   - Consistency: same intent → same tokens everywhere
 *   - Explainability: every value can be traced back to its semantic origin
 *   - AI controllability: LLM manipulates tokens, not raw CSS values
 */

import type { Tone, Density, EmphasisLevel, EmphasisStyle, ColorMood, VisualBalance, ColumnMode } from "./semantic/state";

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC TOKENS (abstract, typed intermediates)
// ═══════════════════════════════════════════════════════════════════════════

export type TypographyProfile = "clean-sans" | "editorial-serif" | "monospace" | "elegant-display" | "scholarly";
export type SpacingProfile = "ultra-compact" | "compact" | "normal" | "spacious" | "generous";
export type ColorProfile = "neutral-light" | "neutral-dark" | "professional" | "bold" | "muted";
export type EmphasisProfile = "flat" | "subtle" | "moderate" | "strong" | "dominant";
export type BalanceProfile = "tight" | "conservative" | "balanced" | "expressive" | "dramatic";

export interface SemanticTokens {
  typographyProfile: TypographyProfile;
  spacingProfile: SpacingProfile;
  colorProfile: ColorProfile;
  emphasisProfile: EmphasisProfile;
  balanceProfile: BalanceProfile;
  sectionColumns: ColumnMode;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC → TOKEN MAPPING (deterministic, no heuristics)
// ═══════════════════════════════════════════════════════════════════════════

const TONE_TYPOGRAPHY: Record<Tone, TypographyProfile> = {
  minimal:   "clean-sans",
  modern:    "clean-sans",
  elegant:   "elegant-display",
  corporate: "editorial-serif",
  creative:  "clean-sans",
};

const DENSITY_SPACING: Record<Density, SpacingProfile> = {
  compact:  "compact",
  normal:   "normal",
  spacious: "spacious",
};

const EMPHASIS_STYLE_EMPHASIS: Record<EmphasisStyle, EmphasisProfile> = {
  minimal:  "flat",
  subtle:   "subtle",
  strong:   "strong",
};

const COLOR_MOOD_PROFILE: Record<ColorMood, ColorProfile> = {
  neutral:      "neutral-light",
  professional: "professional",
  bold:         "bold",
  muted:        "muted",
};

const BALANCE_PROFILE: Record<VisualBalance, BalanceProfile> = {
  conservative: "conservative",
  balanced:     "balanced",
  expressive:   "expressive",
};

/**
 * Convert semantic state into typed semantic tokens.
 * Pure function — no heuristics, no side effects.
 */
export function semanticStateToTokens(opts: {
  tone: Tone;
  density: Density;
  emphasisStyle: EmphasisStyle;
  colorMood: ColorMood;
  visualBalance: VisualBalance;
  columns: ColumnMode;
}): SemanticTokens {
  return {
    typographyProfile: TONE_TYPOGRAPHY[opts.tone],
    spacingProfile: DENSITY_SPACING[opts.density],
    colorProfile: COLOR_MOOD_PROFILE[opts.colorMood],
    emphasisProfile: EMPHASIS_STYLE_EMPHASIS[opts.emphasisStyle],
    balanceProfile: BALANCE_PROFILE[opts.visualBalance],
    sectionColumns: opts.columns,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERING TOKENS (concrete values from theme mappings)
// ═══════════════════════════════════════════════════════════════════════════

export interface TypographyTokens {
  fontFamily: string;
  baseSizePt: number;
  headingSizePt: number;
  nameSizePt: number;
}

export interface SpacingTokens {
  mode: "compact" | "normal" | "spacious";
  sectionGap: number;
  entryGap: number;
  sidebarPadding: number;
}

export interface ColorTokens {
  primary: string;
  accent: string;
  text: string;
  muted: string;
  background: string;
  surface: string;
  border: string;
}

export interface ColumnTokens {
  maxSectionColumns: number;
  sectionOverrides: Record<string, number>;
}

/**
 * Merge semantic tokens with a theme to produce rendering tokens.
 * This is where the theme's aesthetic interpretation is applied.
 */
export function tokensToRenderingState(
  semanticTokens: SemanticTokens,
  theme: {
    toneMap: Record<string, TypographyTokens>;
    colorMoodMap: Record<string, ColorTokens>;
    columnMap: Record<string, ColumnTokens>;
    densityMap: Record<string, { spacingScale: number }>;
  },
  tone: Tone,
  density: Density,
  colorMood: ColorMood,
  columns: ColumnMode
): {
  typography: TypographyTokens;
  colors: ColorTokens;
  spacing: SpacingTokens;
  columns: ColumnTokens;
} {
  const typography = theme.toneMap[tone] || theme.toneMap.modern;
  const colors = theme.colorMoodMap[colorMood] || theme.colorMoodMap.neutral;
  const columnConfig = theme.columnMap[columns] || theme.columnMap.single;

  // Apply density spacing scale
  const densityConfig = theme.densityMap[density] || theme.densityMap.normal;
  const spacingScale = densityConfig.spacingScale;

  const spacing: SpacingTokens = {
    mode: density === "compact" ? "compact" : density === "spacious" ? "spacious" : "normal",
    sectionGap: Math.round(12 * spacingScale),
    entryGap: Math.round(6 * spacingScale),
    sidebarPadding: Math.round(8 * spacingScale),
  };

  return { typography, colors, spacing, columns: columnConfig };
}

/**
 * Create a debug/trace string explaining how each rendering value was derived.
 */
export function explainTokenResolution(tokens: SemanticTokens): string {
  return [
    `typographyProfile: ${tokens.typographyProfile} (from tone)`,
    `spacingProfile: ${tokens.spacingProfile} (from density)`,
    `colorProfile: ${tokens.colorProfile} (from colorMood)`,
    `emphasisProfile: ${tokens.emphasisProfile} (from emphasisStyle)`,
    `balanceProfile: ${tokens.balanceProfile} (from visualBalance)`,
    `sectionColumns: ${tokens.sectionColumns}`,
  ].join(" | ");
}
