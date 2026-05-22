/**
 * Section Renderer — Experience (with variants)
 *
 * Variants:
 *   - default:       standard entry list
 *   - timeline:      left-border timeline with dot markers
 *   - compact-list:  denser, minimal spacing
 *   - cards:         card-based entries
 *   - editorial-flow: magazine-style with accent bars
 */

import type { JsonCv } from "../../agents/writer";
import { escapeHtml } from "../shared/utils";
import { renderEntry } from "./entry";

export type ExperienceVariant = "default" | "timeline" | "compact-list" | "cards" | "editorial-flow";

export function renderExperienceSection(
  section: JsonCv["sections"][0],
  variant: ExperienceVariant = "default",
  order?: number
): string | null {
  if (!section.entries?.length) return null;

  const title = escapeHtml(section.title || "Experience");
  const orderAttr = order !== undefined ? ` style="order:${order}"` : "";

  switch (variant) {
    case "timeline":
      return renderTimeline(section.entries, title, orderAttr);
    case "compact-list":
      return renderCompactList(section.entries, title, orderAttr);
    case "cards":
      return renderCards(section.entries, title, orderAttr);
    case "editorial-flow":
      return renderEditorialFlow(section.entries, title, orderAttr);
    default:
      return renderDefault(section.entries, title, orderAttr);
  }
}

function renderDefault(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
  const items = entries.map((e) => renderEntry({
    heading: e.heading || "",
    subheading: e.subheading || "",
    date: e.date || "",
    description: (e as Record<string, unknown>).description as string | undefined,
    bullets: e.bullets,
  })).join("\n");

  return `<section class="cv-section cv-section--experience" data-section-type="experience"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}

function renderTimeline(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
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

  return `<section class="cv-section cv-section--experience cv-section--timeline" data-section-type="experience" data-variant="timeline"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
<div class="cv-timeline">
${items}
</div>
</section>`;
}

function renderCompactList(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
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

  return `<section class="cv-section cv-section--experience cv-section--compact" data-section-type="experience" data-variant="compact-list"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}

function renderCards(entries: JsonCv["sections"][0]["entries"], title: string, orderAttr: string): string {
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

  return `<section class="cv-section cv-section--experience cv-section--cards" data-section-type="experience" data-variant="cards"${orderAttr}>
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

  return `<section class="cv-section cv-section--experience cv-section--editorial" data-section-type="experience" data-variant="editorial-flow"${orderAttr}>
<h2 class="cv-section-title">${title}</h2>
${items}
</section>`;
}
