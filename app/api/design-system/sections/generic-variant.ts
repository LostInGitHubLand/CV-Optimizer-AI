/**
 * Section Renderer — Generic Entry Section with Variants
 *
 * Shared variant renderer for: certifications, awards, publications,
 * projects, volunteers, and any other entry-based section.
 *
 * Variants:
 *   - default:        standard entry list
 *   - cards:          card-based entries
 *   - timeline:       left-border timeline with dot markers
 *   - editorial-flow: magazine-style with accent bars
 *
 * CSS classes (consistent with experience.ts):
 *   cv-section--cards, cv-section--timeline, cv-section--editorial
 *   cv-entry--card, cv-entry--editorial
 *   cv-timeline, cv-timeline-entry
 */

import type { JsonCv } from "../../agents/writer";
import { escapeHtml } from "../shared/utils";

export type GenericVariant = "default" | "cards" | "timeline" | "editorial-flow";

export function renderEntrySectionWithVariant(
  section: JsonCv["sections"][0],
  variant: GenericVariant = "default",
  order?: number
): string | null {
  if (!section.entries?.length) return null;

  const title = escapeHtml(section.title || section.type || "Section");
  const sectionType = escapeHtml(section.type || "generic");
  const orderAttr = order !== undefined ? ` style="order:${order}"` : "";

  // Normalize: unsupported → default
  const effectiveVariant: GenericVariant =
    ["cards", "timeline", "editorial-flow"].includes(variant) ? variant : "default";

  switch (effectiveVariant) {
    case "cards":
      return renderCards(section.entries, title, sectionType, orderAttr);
    case "timeline":
      return renderTimeline(section.entries, title, sectionType, orderAttr);
    case "editorial-flow":
      return renderEditorialFlow(section.entries, title, sectionType, orderAttr);
    default:
      return renderDefault(section.entries, title, sectionType, orderAttr);
  }
}

function renderDefault(
  entries: JsonCv["sections"][0]["entries"],
  title: string,
  sectionType: string,
  orderAttr: string
): string {
  const items = entries.map((e) => renderEntryHtml(e)).join("\n");

  return `<section class="cv-section cv-section--${sectionType}" data-section-type="${sectionType}"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}

function renderCards(
  entries: JsonCv["sections"][0]["entries"],
  title: string,
  sectionType: string,
  orderAttr: string
): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const desc = escapeHtml(((e as Record<string, unknown>).description || "") as string);
    const bullets = e.bullets?.length
      ? `<ul class="cv-entry-bullets">${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";

    return `<div class="cv-entry cv-entry--card">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${desc ? `<div class="cv-entry-description">${desc}</div>` : ""}
${bullets}
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--${sectionType} cv-section--cards" data-section-type="${sectionType}" data-variant="cards"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
<div class="cv-entry-grid">
${items}
</div>
</section>`;
}

function renderTimeline(
  entries: JsonCv["sections"][0]["entries"],
  title: string,
  sectionType: string,
  orderAttr: string
): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const desc = escapeHtml(((e as Record<string, unknown>).description || "") as string);
    const bullets = e.bullets?.length
      ? `<ul class="cv-entry-bullets">${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";

    return `<div class="cv-timeline-entry">
<div class="cv-timeline-marker"></div>
<div class="cv-timeline-content">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${desc ? `<div class="cv-entry-description">${desc}</div>` : ""}
${bullets}
</div>
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--${sectionType} cv-section--timeline" data-section-type="${sectionType}" data-variant="timeline"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
<div class="cv-timeline">
${items}
</div>
</section>`;
}

function renderEditorialFlow(
  entries: JsonCv["sections"][0]["entries"],
  title: string,
  sectionType: string,
  orderAttr: string
): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const desc = escapeHtml(((e as Record<string, unknown>).description || "") as string);
    const bullets = e.bullets?.length
      ? `<ul class="cv-entry-bullets">${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
      : "";

    return `<div class="cv-entry cv-entry--editorial">
<div class="cv-entry-accent-bar"></div>
<div class="cv-entry-content">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${desc ? `<div class="cv-entry-description">${desc}</div>` : ""}
${bullets}
</div>
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--${sectionType} cv-section--editorial" data-section-type="${sectionType}" data-variant="editorial-flow"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}

/** Render a single entry for the default view */
function renderEntryHtml(e: JsonCv["sections"][0]["entries"][0]): string {
  const h = escapeHtml(e.heading || "");
  const s = escapeHtml(e.subheading || "");
  const d = escapeHtml(e.date || "");
  const desc = escapeHtml(((e as Record<string, unknown>).description || "") as string);
  const bullets = e.bullets?.length
    ? `<ul class="cv-entry-bullets">${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";

  return `<div class="cv-entry">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${desc ? `<div class="cv-entry-description">${desc}</div>` : ""}
${bullets}
</div>`;
}
