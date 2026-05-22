/**
 * Section Renderer — Education (with variants)
 *
 * Variants:
 *   - default:       standard entry list
 *   - compact:       denser, minimal descriptions
 *   - timeline:      left-border timeline with dot markers
 */

import type { JsonCv } from "../../agents/writer";
import { escapeHtml } from "../shared/utils";

export type EducationVariant = "default" | "compact" | "timeline" | "cards" | "editorial-flow";

export function renderEducationSection(
  section: JsonCv["sections"][0],
  variant: EducationVariant = "default",
  order?: number
): string | null {
  if (!section.entries?.length) return null;

  const title = escapeHtml(section.title || "Education");
  const orderAttr = order !== undefined ? ` style="order:${order}"` : "";

  // Normalize: unsupported → default
  const effectiveVariant: EducationVariant =
    ["compact", "timeline", "cards", "editorial-flow"].includes(variant) ? variant : "default";

  switch (effectiveVariant) {
    case "compact":
      return renderCompact(section.entries, title, orderAttr);
    case "timeline":
      return renderTimeline(section.entries, title, orderAttr);
    case "cards":
      return renderCards(section.entries, title, orderAttr);
    case "editorial-flow":
      return renderEditorialFlow(section.entries, title, orderAttr);
    default:
      return renderDefault(section.entries, title, orderAttr);
  }
}

function renderDefault(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const grade = escapeHtml(((e as Record<string, unknown>).grade || "") as string);
    return `<div class="cv-entry">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${grade ? `<div class="cv-entry-grade">${grade}</div>` : ""}
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--education" data-section-type="education"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}

function renderCompact(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    return `<div class="cv-entry cv-entry--compact">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--education cv-section--compact" data-section-type="education" data-variant="compact"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}

function renderTimeline(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const grade = escapeHtml(((e as Record<string, unknown>).grade || "") as string);
    return `<div class="cv-timeline-entry">
<div class="cv-timeline-marker"></div>
<div class="cv-timeline-content">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${grade ? `<div class="cv-entry-grade">${grade}</div>` : ""}
</div>
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--education cv-section--timeline" data-section-type="education" data-variant="timeline"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
<div class="cv-timeline">
${items}
</div>
</section>`;
}

function renderCards(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const grade = escapeHtml(((e as Record<string, unknown>).grade || "") as string);
    return `<div class="cv-entry cv-entry--card">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${grade ? `<div class="cv-entry-grade">${grade}</div>` : ""}
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--education cv-section--cards" data-section-type="education" data-variant="cards"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
<div class="cv-entry-grid">
${items}
</div>
</section>`;
}

function renderEditorialFlow(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
  const items = entries.map((e) => {
    const h = escapeHtml(e.heading || "");
    const s = escapeHtml(e.subheading || "");
    const d = escapeHtml(e.date || "");
    const grade = escapeHtml(((e as Record<string, unknown>).grade || "") as string);
    return `<div class="cv-entry cv-entry--editorial">
<div class="cv-entry-accent-bar"></div>
<div class="cv-entry-content">
<div class="cv-entry-header">
<span class="cv-entry-title">${h}</span>
<span class="cv-entry-dates">${d}</span>
</div>
${s ? `<div class="cv-entry-subtitle">${s}</div>` : ""}
${grade ? `<div class="cv-entry-grade">${grade}</div>` : ""}
</div>
</div>`;
  }).join("\n");

  return `<section class="cv-section cv-section--education cv-section--editorial" data-section-type="education" data-variant="editorial-flow"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}
