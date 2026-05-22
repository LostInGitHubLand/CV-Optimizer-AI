/**
 * Design System — Serialization
 *
 * Store/restore DesignState from JSON strings.
 * Uses layoutId + themeId (no templateId).
 */

import type { DesignState } from "./types";
import { createDesignState } from "./engine";
import type { LayoutId } from "../layouts/registry";
import type { ThemeId } from "../themes/registry";

export function serializeDesignState(state: DesignState): string {
  return JSON.stringify(state);
}

export function deserializeDesignState(
  raw: string | null | undefined,
  fallbackLayout: LayoutId = "single-column",
  fallbackTheme: ThemeId = "minimal-swiss"
): DesignState {
  if (!raw) {
    return createDesignState(fallbackLayout, fallbackTheme);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<DesignState>;

    // Determine layout/theme from parsed state or fallbacks
    const layoutId = (parsed.layoutId ?? fallbackLayout) as LayoutId;
    const themeId = (parsed.themeId ?? fallbackTheme) as ThemeId;

    const defaults = createDesignState(layoutId, themeId);

    if (parsed.colors) Object.assign(defaults.colors, parsed.colors);
    if (parsed.typography) Object.assign(defaults.typography, parsed.typography);
    if (parsed.decorations) Object.assign(defaults.decorations, parsed.decorations);
    if (parsed.layout) {
      Object.assign(defaults.layout, parsed.layout);
      if (!defaults.layout.columnOverrides) defaults.layout.columnOverrides = {};
    }

    return defaults;
  } catch {
    return createDesignState(fallbackLayout, fallbackTheme);
  }
}
