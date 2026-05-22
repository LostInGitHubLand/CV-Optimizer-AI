/**
 * Design System — CSS Variable Generation
 * Deterministic output from DesignState.
 */

import type { DesignState, SpacingMode } from "./types";

export function designStateToCssVariables(state: DesignState): string {
  const spacingMultiplier: Record<SpacingMode, string> = {
    compact: "0.85", normal: "1.0", spacious: "1.25",
  };

  let columnVars = "";
  for (const [section, cols] of Object.entries(state.layout.columnOverrides)) {
    columnVars += `  --cv-section-cols-${section}: ${cols};\n`;
  }

  // AC13: Use correct property names (baseSize not baseSizePt)
  // AC4: Return raw CSS, NO <style> wrapper (caller handles wrapping)
  return `:root {
  --cv-primary:    ${state.colors.primary};
  --cv-accent:     ${state.colors.accent};
  --cv-text:       ${state.colors.text};
  --cv-muted:      ${state.colors.muted};
  --cv-bg:         ${state.colors.background};
  --cv-surface:    ${state.colors.surface};
  --cv-border:     ${state.colors.border};
  --cv-font:       ${state.typography.fontFamily};
  --cv-fs-base:    ${state.typography.baseSizePt}pt;
  --cv-fs-heading: ${state.typography.headingSizePt}pt;
  --cv-fs-name:    ${state.typography.nameSizePt}pt;
  --cv-spacing:    ${spacingMultiplier[state.layout.spacing]};
${columnVars}}`;
}
