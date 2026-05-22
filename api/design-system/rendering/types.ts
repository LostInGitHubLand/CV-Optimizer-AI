/**
 * Design System — Rendering Types
 *
 * DesignState is the canonical resolved rendering state.
 * Carries layout + theme + semantic resolution results.
 * No templateId. No legacy concepts.
 */

import type { LayoutId } from "../layouts/registry";
import type { ThemeId } from "../themes/registry";
import type { DecorationTokens } from "../themes/registry";

export interface ColorPalette {
  primary: string;
  accent: string;
  text: string;
  muted: string;
  background: string;
  surface: string;
  border: string;
}

export interface Typography {
  fontFamily: string;
  baseSizePt: number;
  headingSizePt: number;
  nameSizePt: number;
}

export type SpacingMode = "compact" | "normal" | "spacious";

export interface LayoutConfig {
  sectionOrder: string[];
  spacing: SpacingMode;
  columnOverrides: Record<string, number>;
}

/**
 * Fully resolved concrete rendering state.
 * Produced by resolveSemanticDesign() from layout + theme + semantic state.
 */
export interface DesignState {
  layoutId: LayoutId;
  themeId: ThemeId;
  colors: ColorPalette;
  typography: Typography;
  decorations: DecorationTokens;
  layout: LayoutConfig;
}

/**
 * DesignAction — low-level rendering overrides.
 * These are explicit concrete changes, NOT semantic intent.
 * The LLM should NOT produce these directly.
 */
export type DesignAction =
  | { type: "set_color"; target: "primary" | "accent" | "text" | "muted" | "background" | "surface" | "border"; value: string }
  | { type: "set_font_family"; value: string }
  | { type: "set_font_size"; target: "base" | "heading" | "name"; valuePt: number }
  | { type: "move_section"; section: string; position: string; reference?: string }
  | { type: "set_spacing"; value: SpacingMode }
  | { type: "set_layout"; layoutId: LayoutId }
  | { type: "set_theme"; themeId: ThemeId }
  | { type: "set_layout_columns"; section: string; columns: number };

export interface DesignActionSet {
  actions: DesignAction[];
}
