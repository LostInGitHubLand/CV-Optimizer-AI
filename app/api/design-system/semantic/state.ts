/**
 * Design System — Semantic State
 * High-level visual intent types and state management.
 */

export type Tone = "minimal" | "modern" | "elegant" | "corporate" | "creative";
export type Density = "compact" | "normal" | "spacious";
export type EmphasisLevel = "low" | "medium" | "high";
export type VisualBalance = "conservative" | "balanced" | "expressive";
export type ColumnMode = "single" | "two";
export type EmphasisStyle = "subtle" | "strong" | "minimal";
export type ColorMood = "neutral" | "professional" | "bold" | "muted";

export interface SemanticDesignState {
  tone: Tone;
  density: Density;
  hierarchy: Record<string, EmphasisLevel>;
  layoutPreference: { columns: ColumnMode; visualBalance: VisualBalance };
  emphasisStyle: EmphasisStyle;
  colorMood: ColorMood;
}

export const DEFAULT_SEMANTIC_STATE: SemanticDesignState = {
  tone: "modern",
  density: "normal",
  hierarchy: {},
  layoutPreference: { columns: "single", visualBalance: "balanced" },
  emphasisStyle: "subtle",
  colorMood: "neutral",
};

export function serializeSemanticState(state: SemanticDesignState): string {
  return JSON.stringify(state);
}

export function deserializeSemanticState(raw: string | null | undefined): SemanticDesignState {
  if (!raw) return { ...DEFAULT_SEMANTIC_STATE };
  try {
    const parsed = JSON.parse(raw) as Partial<SemanticDesignState>;
    return { ...DEFAULT_SEMANTIC_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_SEMANTIC_STATE };
  }
}
