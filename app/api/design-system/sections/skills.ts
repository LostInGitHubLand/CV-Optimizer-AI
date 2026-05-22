/**
 * Section Renderer — Skills (with variants)
 *
 * Architecture:
 *   - Skill groups/containers are ALWAYS stacked vertically
 *   - NO column support, NO group columns, NO item columns
 *   - Only one variant operates on groups: floating-cards (one card per group)
 *   - All other variants operate on ITEMS inside each group
 *
 * Variants:
 *   - grouped-pills:     category groups with pill-shaped items (default)
 *   - compact-tags:      items as compact inline tags inside each group
 *   - terminal-stack:    monospace bracket-wrapped items inside each group
 *   - visual-matrix:     grid layout of items inside each group
 *   - expertise-bars:    skill name + proficiency bar inside each group
 *                        ONLY if EVERY item has an explicit percentage
 *                        Falls back to grouped-pills if any item is missing a level
 *   - floating-cards:    ONE CARD per skill group (only variant that changes group container)
 */

import type { Logger } from "../../infrastructure/logging/logger";
import type { JsonCv } from "../../agents/writer";
import { escapeHtml } from "../shared/utils";

export type SkillsVariant =
  | "compact-tags" | "grouped-pills" | "terminal-stack" | "visual-matrix"
  | "expertise-bars" | "floating-cards" | "accent-pills" | "accent-pills-flat";

interface SkillGroup {
  name: string;
  items: string[];
}

/** Extract skill groups from JsonCv */
function extractGroups(cv: JsonCv): SkillGroup[] {
  return cv.skills?.categories ?? [];
}

/**
 * Resolve a skill's level.
 * Priority:
 *   1. Explicit per-skill override (levels[skillName])
 *   2. set_all_skill_levels default (levels._default)
 *   3. Fallback 100 (full bar)
 */
function resolveSkillLevelRaw(
  skillName: string,
  levels?: Record<string, number>
): number {
  const normalized = skillName.toLowerCase().trim();
  if (levels) {
    if (levels[normalized] !== undefined) return clampLevel(levels[normalized]);
    if (levels[skillName] !== undefined) return clampLevel(levels[skillName]);
    // set_all_skill_levels stores default as _default
    if (levels._default !== undefined) return clampLevel(levels._default);
  }
  return 100;
}

function clampLevel(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export function renderSkillsSection(
  cv: JsonCv,
  variant: SkillsVariant = "grouped-pills",
  levels?: Record<string, number>,
  log?: Logger
): string {
  const cats = extractGroups(cv);
  if (!cats || cats.length === 0) return "";

  // expertise-bars: missing levels default to 100 (full bar), not grouped-pills
  if (variant === "expertise-bars") {
    // No validation needed — missing levels render as full bars
  }

  switch (variant) {
    case "compact-tags":
      return renderCompactTags(cats);
    case "terminal-stack":
      return renderTerminalStack(cats);
    case "visual-matrix":
      return renderVisualMatrix(cats);
    case "expertise-bars":
      return renderExpertiseBars(cats, levels);
    case "floating-cards":
      return renderFloatingCards(cats);
    case "accent-pills":
      return renderAccentPills(cats, false);
    case "accent-pills-flat":
      return renderAccentPills(cats, true);
    default:
      return renderGroupedPills(cats);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT RENDERERS — groups always stacked vertically
// ═══════════════════════════════════════════════════════════════════════════

/** grouped-pills: groups stacked, items as pills inside each group */
function renderGroupedPills(cats: SkillGroup[]): string {
  const groups = cats.map((cat) => [
    '<div class="cv-skill-group">',
    cat.name ? `<span class="cv-skill-group-title">${escapeHtml(cat.name)}</span>` : "",
    '<div class="cv-skill-items">',
    (cat.items || []).map((item) => `<span class="cv-skill-item">${escapeHtml(item)}</span>`).join(" "),
    "</div>",
    "</div>",
  ].join("\n")).join("\n");

  return `<div class="cv-skills cv-skills--grouped">\n${groups}\n</div>`;
}

/** compact-tags: groups stacked, items as compact inline tags inside each group */
function renderCompactTags(cats: SkillGroup[]): string {
  const groups = cats.map((cat) => [
    '<div class="cv-skill-group">',
    cat.name ? `<span class="cv-skill-group-title">${escapeHtml(cat.name)}</span>` : "",
    '<div class="cv-skill-items cv-skill-items--compact">',
    (cat.items || []).map((item) => `<span class="cv-skill-item cv-skill-item--compact">${escapeHtml(item)}</span>`).join(" "),
    "</div>",
    "</div>",
  ].join("\n")).join("\n");

  return `<div class="cv-skills cv-skills--compact">\n${groups}\n</div>`;
}

/** terminal-stack: groups stacked, items as monospace brackets inside each group */
function renderTerminalStack(cats: SkillGroup[]): string {
  const groups = cats.map((cat) => {
    const items = (cat.items || []).map((item) => `<span class="cv-skill-item cv-skill-item--terminal">[${escapeHtml(item)}]</span>`).join(" ");
    return `<div class="cv-skill-group cv-skill-group--terminal">${cat.name ? `<span class="cv-skill-group-title">${escapeHtml(cat.name)}$</span>` : ""}\n<div class="cv-skill-items cv-skill-items--terminal">\n${items}\n</div></div>`;
  }).join("\n");

  return `<div class="cv-skills cv-skills--terminal">\n${groups}\n</div>`;
}

/** visual-matrix: groups stacked, items as a grid INSIDE each group */
function renderVisualMatrix(cats: SkillGroup[]): string {
  const groups = cats.map((cat) => {
    const items = (cat.items || []).map((item) => `<span class="cv-skill-item cv-skill-item--matrix">${escapeHtml(item)}</span>`).join("\n");
    return `<div class="cv-skill-group cv-skill-group--matrix">\n${cat.name ? `<span class="cv-skill-group-title">${escapeHtml(cat.name)}</span>` : ""}\n<div class="cv-skill-grid" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">\n${items}\n</div></div>`;
  }).join("\n");

  return `<div class="cv-skills cv-skills--matrix">\n${groups}\n</div>`;
}

/** expertise-bars: groups stacked, items as bars inside each group */
function renderExpertiseBars(
  cats: SkillGroup[],
  levels?: Record<string, number>
): string {
  const groups = cats.map((cat) => {
    const bars = (cat.items || []).map((item) => {
      const proficiency = resolveSkillLevelRaw(item, levels);
      return `<div class="cv-expertise-bar">\n<span class="cv-expertise-label">${escapeHtml(item)}</span>\n<div class="cv-expertise-track">\n<div class="cv-expertise-fill" style="width:${proficiency}%"></div>\n</div></div>`;
    }).join("\n");

    return `<div class="cv-skill-group cv-skill-group--bars">\n${cat.name ? `<span class="cv-skill-group-title">${escapeHtml(cat.name)}</span>` : ""}\n<div class="cv-skill-bars">\n${bars}\n</div></div>`;
  }).join("\n");

  return `<div class="cv-skills cv-skills--bars">\n${groups}\n</div>`;
}

/** floating-cards: ONE CARD per skill group (only variant that changes group container) */
function renderFloatingCards(cats: SkillGroup[]): string {
  const cards = cats.map((cat) => {
    const items = (cat.items || []).map((item) => `<span class="cv-skill-item cv-skill-item--floating">${escapeHtml(item)}</span>`).join("\n");
    return `<div class="cv-skill-card">\n${cat.name ? `<h4 class="cv-skill-card-title">${escapeHtml(cat.name)}</h4>` : ""}\n<div class="cv-skill-card-items">\n${items}\n</div></div>`;
  }).join("\n");

  return `<div class="cv-skills cv-skills--floating">\n${cards}\n</div>`;
}

/** accent-pills: rounded filled pills; grouped preserves categories, flat flattens all */
function renderAccentPills(cats: SkillGroup[], flat: boolean): string {
  if (flat) {
    const allItems = cats.flatMap((cat) => cat.items || []);
    const deduped = [...new Set(allItems)];
    const pills = deduped.map((item) => `<span class="cv-skill-pill cv-skill-pill--accent">${escapeHtml(item)}</span>`).join("\n");
    return `<div class="cv-skills cv-skills--accent-pills cv-skills--flat">\n${pills}\n</div>`;
  }

  // Grouped mode
  const groups = cats.map((cat) => [
    '<div class="cv-skill-group">',
    cat.name ? `<span class="cv-skill-group-title">${escapeHtml(cat.name)}</span>` : "",
    '<div class="cv-skill-items">',
    (cat.items || []).map((item) => `<span class="cv-skill-pill cv-skill-pill--accent">${escapeHtml(item)}</span>`).join("\n"),
    "</div>",
    "</div>",
  ].join("\n")).join("\n");

  return `<div class="cv-skills cv-skills--accent-pills">\n${groups}\n</div>`;
}

/**
 * Render a flat skill list (no categories, no variants).
 */
export function renderSkillsFlat(items: string[]): string {
  if (!items || items.length === 0) return "";
  return `<div class="cv-skills cv-skills--flat">\n<div class="cv-skill-items">\n${items.map((item) => `<span class="cv-skill-item">${escapeHtml(item)}</span>`).join(" ")}\n</div>\n</div>`;
}
