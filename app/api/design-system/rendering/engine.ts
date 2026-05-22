/**
 * Design System — Rendering Engine
 *
 * Deterministic state mutation.
 * Resolution: Layout → Theme → Semantic → Normalization → DesignState
 */

import type { LayoutId } from "../layouts/registry";
import { getLayout } from "../layouts/registry";
import type { ThemeId } from "../themes/registry";
import { getTheme } from "../themes/registry";
import type { Logger } from "../../infrastructure/logging/logger";
import type { DesignState, DesignAction, SpacingMode } from "./types";
export type { DesignState, DesignAction, SpacingMode };

// ── Factory: create from explicit layout + theme ──

export function createDesignState(layoutId: LayoutId, themeId: ThemeId): DesignState {
  const layout = getLayout(layoutId);
  const theme = getTheme(themeId);

  return JSON.parse(JSON.stringify({
    layoutId,
    themeId,
    colors: { ...theme.colors },
    typography: { ...theme.typography },
    decorations: { ...theme.decorations },
    layout: {
      sectionOrder: [...layout.defaultSectionOrder],
      spacing: theme.spacing,
      columnOverrides: {},
    },
  })) as DesignState;
}

// ── Action Application ──

export function applyActions(state: DesignState, actions: DesignAction[], log: Logger): DesignState {
  const next = JSON.parse(JSON.stringify(state)) as DesignState;

  for (const action of actions) {
    switch (action.type) {
      case "set_color": {
        if (isValidColor(action.value)) {
          (next.colors as Record<string, string>)[action.target] = action.value;
          log.info("ENGINE", `set_color: ${action.target} → ${action.value}`);
        } else {
          log.warn("ENGINE", `Invalid color rejected: ${action.value}`);
        }
        break;
      }
      case "set_font_family": {
        next.typography.fontFamily = action.value;
        log.info("ENGINE", `set_font_family: → ${action.value}`);
        break;
      }
      case "set_font_size": {
        const clamped = clampFontSize(action.valuePt, action.target);
        switch (action.target) {
          case "base": next.typography.baseSize = clamped; break;
          case "heading": next.typography.headingSize = clamped; break;
          case "name": next.typography.nameSize = clamped; break;
        }
        log.info("ENGINE", `set_font_size: ${action.target} → ${clamped}pt`);
        break;
      }
      case "move_section": {
        const reordered = moveSection(next.layout.sectionOrder, action.section, action.position, action.reference);
        if (reordered) {
          next.layout.sectionOrder = reordered;
          log.info("ENGINE", `move_section: ${action.section} ${action.position}`);
        }
        break;
      }
      case "set_spacing": {
        if (["compact", "normal", "spacious"].includes(action.value)) {
          next.layout.spacing = action.value;
          log.info("ENGINE", `set_spacing: → ${action.value}`);
        }
        break;
      }
      case "set_layout": {
        const layout = getLayout(action.layoutId);
        next.layoutId = action.layoutId;
        next.layout.sectionOrder = [...layout.defaultSectionOrder];
        log.info("ENGINE", `set_layout: ${action.layoutId}`);
        break;
      }
      case "set_theme": {
        const theme = getTheme(action.themeId);
        next.themeId = action.themeId;
        next.colors = { ...theme.colors };
        next.typography = { ...theme.typography };
        next.decorations = { ...theme.decorations };
        next.layout.spacing = theme.spacing;
        log.info("ENGINE", `set_theme: ${action.themeId}`);
        break;
      }
      case "set_layout_columns": {
        const clamped = Math.max(1, Math.min(3, Math.round(action.columns)));
        next.layout.columnOverrides[action.section] = clamped;
        log.info("ENGINE", `set_columns: ${action.section} → ${clamped}`);
        break;
      }
      default: {
        log.warn("ENGINE", `Unknown action: ${JSON.stringify(action)}`);
      }
    }
  }

  return next;
}

// ── Helpers ──

function isValidColor(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  return /^#([0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6,8})$|^rgb\(|^rgba\(|^hsl\(|^hsla\(|^[a-zA-Z]+$/.test(value.trim());
}

function clampFontSize(pt: number, target: "base" | "heading" | "name"): number {
  const limits: Record<string, [number, number]> = { base: [7, 13], heading: [9, 16], name: [14, 36] };
  const [min, max] = limits[target] || [7, 36];
  return Math.max(min, Math.min(max, Math.round(pt)));
}

function moveSection(order: string[], section: string, position: string, reference?: string): string[] | null {
  const idx = order.indexOf(section);
  if (idx < 0) return null;
  const next = [...order];
  next.splice(idx, 1);
  const lowerPos = position.toLowerCase().trim();
  if (lowerPos === "top" || lowerPos === "first") { next.unshift(section); return next; }
  if (lowerPos === "bottom" || lowerPos === "last") { next.push(section); return next; }
  const ref = reference || lowerPos.replace(/^(before|after):/, "").trim();
  if (!ref) return null;
  const refIdx = next.indexOf(ref);
  if (refIdx < 0) return null;
  if (lowerPos.startsWith("before") || lowerPos === "above") {
    next.splice(refIdx, 0, section);
  } else {
    next.splice(refIdx + 1, 0, section);
  }
  return next;
}

// Low-level DesignAction schema removed — LLM now uses SEMANTIC_DESIGN_SCHEMA exclusively
// from api/design-system/semantic/schema.ts
