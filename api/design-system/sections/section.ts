/**
 * Section Renderer — Generic Section Dispatcher
 *
 * Routes sections to their variant-aware renderers based on type + variant.
 * Uses composition.sectionVariants to determine which variant to render.
 */

import type { JsonCv } from "../../agents/writer";
import { escapeHtml } from "../shared/utils";
import { renderExperienceSection } from "./experience";
import { renderEducationSection } from "./education";
import { renderEntrySectionWithVariant } from "./generic-variant";

export interface SectionRenderContext {
  variant?: string;
  order?: number;
}

/**
 * Render a CV section, dispatching to the appropriate variant-aware renderer.
 */
export function renderSection(
  section: JsonCv["sections"][0],
  context: SectionRenderContext = {}
): string | null {
  if (!section.entries?.length && section.type !== "interests" && section.type !== "summary") return null;

  const sectionType = section.type || "generic";
  const variant = context.variant || "default";
  const order = context.order;

  // Dispatch to variant-aware renderers
  switch (sectionType) {
    case "experience":
      return renderExperienceSection(section, variant as any, order);
    case "education":
      return renderEducationSection(section, variant as any, order);
    case "interests":
      return renderInterestsSection(section);
    // Generic entry sections: certifications, awards, publications, projects, volunteers, etc.
    // All support: default, cards, timeline, editorial-flow
    default:
      return renderEntrySectionWithVariant(section, variant as any, order);
  }
}

/**
 * Render a summary section (special handling: no entries, just text).
 */
export function renderSummarySection(text: string): string {
  if (!text?.trim()) return "";
  return `<section class="cv-section" data-section-type="summary">
<h2 class="cv-section-title">Professional Summary</h2>
<p class="cv-summary-text">${escapeHtml(text.trim())}</p>
</section>`;
}

/**
 * Render an interests section as a list of tags.
 */
export function renderInterestsSection(section: JsonCv["sections"][0]): string {
  if (!section.entries?.length) return "";
  const title = escapeHtml(section.title || "Interests");

  return `<section class="cv-section" data-section-type="interests">
<h2 class="cv-section-title">${title}</h2>
<div class="cv-interests">
${section.entries.map((e) => `<span class="cv-interest-item">${escapeHtml(e.heading || "")}</span>`).join(" ")}
</div>
</section>`;
}
