/**
 * Design System — Semantic Renderer
 *
 * Deterministic rendering engine.
 * Produces semantic HTML with generic CSS class names.
 * Visual styling comes entirely from theme CSS variables.
 *
 * Renderer contract:
 *   renderSemanticHtml(cv, composition, designState)
 *
 * Uses composition.sectionLayout to route sections to sidebar/main.
 * Uses composition.sectionVariants to select per-section rendering variants.
 *
 * DETERMINISTIC RULES:
 *   - No layout inference
 *   - No theme inference
 *   - No template logic
 *   - composition.sectionLayout.main controls main area order
 *   - composition.sectionLayout.sidebar controls sidebar area order
 *   - composition.sectionVariants controls per-section rendering style
 */

import type { JsonCv } from "../agents/writer";
import type { DesignComposition } from "./composition";
import type { DesignState } from "./rendering/types";
import {
  renderSection,
  renderSummarySection,
  renderInterestsSection,
  renderExperienceSection,
  renderEducationSection,
  renderSkillsSection,
  renderContacts,
  renderLanguages,
  extractContacts,
  extractLanguages,
} from "./sections";

/**
 * Render a full CV as semantic HTML.
 */
export function renderSemanticHtml(
  cv: JsonCv,
  composition: DesignComposition,
  designState: DesignState
): string {
  if (!cv) throw new Error("renderSemanticHtml: cv is undefined");
  if (!composition) throw new Error("renderSemanticHtml: composition is undefined");
  if (!designState) throw new Error("renderSemanticHtml: designState is undefined");

  const sections = cv.sections || [];

  const sidebarHtml = composition.sectionLayout.sidebar
    ? buildSidebar(cv, sections, composition.sectionLayout.sidebar, composition.sectionVariants, composition.sectionDataOverrides)
    : "";

  const mainHtml = buildMain(cv, sections, composition.sectionLayout.main, composition.sectionVariants, composition.sectionDataOverrides);

  return composeDocument(cv, sidebarHtml, mainHtml, designState, composition);
}

/** Check if a section type is in the layout (main or sidebar) */
function hasSectionInLayout(sectionType: string, composition: DesignComposition): boolean {
  return composition.sectionLayout.main.includes(sectionType) ||
    (composition.sectionLayout.sidebar?.includes(sectionType) ?? false);
}

/**
 * Build sidebar content.
 * Every block is wrapped in <section class="cv-section cv-section--TYPE"> with <h2> title.
 */
function buildSidebar(
  cv: JsonCv,
  sections: JsonCv["sections"],
  sidebarSectionTypes: string[],
  sectionVariants: Record<string, string>,
  sectionDataOverrides: DesignComposition["sectionDataOverrides"]
): string {
  const parts: string[] = [];

  for (const sectionType of sidebarSectionTypes) {
    const variant = sectionVariants[sectionType];
    const rendered = renderSectionByType(cv, sections, sectionType, variant, "sidebar", undefined, sectionDataOverrides);
    if (rendered) parts.push(rendered);
  }

  return parts.join("\n");
}

/**
 * Build main content.
 * Iterates composition.sectionLayout.main ORDER — not cv.sections order.
 * If mainSectionTypes = ["education", "experience"], education renders first.
 */
function buildMain(
  cv: JsonCv,
  sections: JsonCv["sections"],
  mainSectionTypes: string[],
  sectionVariants: Record<string, string>,
  sectionDataOverrides: DesignComposition["sectionDataOverrides"]
): string {
  const parts: string[] = [];
  let order = 1;

  for (const sectionType of mainSectionTypes) {
    const variant = sectionVariants[sectionType];
    const rendered = renderSectionByType(cv, sections, sectionType, variant, "main", order++, sectionDataOverrides);
    if (rendered) parts.push(rendered);
  }

  return parts.join("\n");
}

/**
 * Shared helper: render a section by its type, used by both sidebar and main.
 *
 * Handles all section types deterministically:
 *   - contacts, skills, languages, interests (sidebar-friendly)
 *   - experience, education, certifications, awards, projects, publications
 *   - summary (from cv.summary, not a section entry)
 *   - generic (fallback to renderSection)
 *
 * @param area — "sidebar" or "main" — affects default variant choices
 * @param order — CSS order value (main only)
 */
function renderSectionByType(
  cv: JsonCv,
  sections: JsonCv["sections"],
  sectionType: string,
  variant: string | undefined,
  area: "sidebar" | "main",
  order: number | undefined,
  sectionDataOverrides: DesignComposition["sectionDataOverrides"]
): string | null {
  const effectiveVariant = variant || getDefaultVariant(sectionType, area);

  // Normalize language variant: "expertise-bars" → "proficiency-bars"
  const finalVariant = sectionType === "languages" && effectiveVariant === "expertise-bars"
    ? "proficiency-bars"
    : effectiveVariant;

  switch (sectionType) {
    case "contacts": {
      const contacts = extractContacts(cv);
      if (contacts.length === 0) return null;
      const inner = renderContacts(contacts, finalVariant as any);
      return wrapSection(inner, "contacts", "Contacts");
    }
    case "skills": {
      const skillLevels = sectionDataOverrides?.skills?.levels;
      console.log(`[RENDERER] skills — variant: ${finalVariant}, levels keys: ${Object.keys(skillLevels ?? {}).join(",") || "none"}`);
      const inner = renderSkillsSection(cv, finalVariant as any, skillLevels);
      if (!inner) return null;
      return wrapSection(inner, "skills", "Skills");
    }
    case "languages": {
      const langs = extractLanguages(cv);
      if (langs.length === 0) return null;
      const langLevels = sectionDataOverrides?.languages?.levels;
      const langProfs = sectionDataOverrides?.languages?.proficiencies;
      console.log(`[RENDERER] languages — variant: ${finalVariant}, levels keys: ${Object.keys(langLevels ?? {}).join(",") || "none"}, prof keys: ${Object.keys(langProfs ?? {}).join(",") || "none"}`);
      const inner = renderLanguages(langs, finalVariant as any, langLevels, langProfs);
      return wrapSection(inner, "languages", "Languages");
    }
    case "interests": {
      const section = sections.find((s) => s.type === "interests");
      if (!section || !section.entries?.length) return null;
      // renderInterestsSection already produces <section><h2>...</h2>...</section>
      // Do NOT wrap — would produce double title.
      return renderInterestsSection(section);
    }
    case "summary": {
      if (!cv.summary?.trim()) return null;
      // renderSummarySection already produces <section><h2>...</h2>...</section>
      // Do NOT wrap — would produce double title.
      return renderSummarySection(cv.summary);
    }
    case "experience": {
      const section = sections.find((s) => s.type === "experience");
      if (!section || !section.entries?.length) return null;
      const inner = renderExperienceSection(section, finalVariant as any, order);
      return inner;
    }
    case "education": {
      const section = sections.find((s) => s.type === "education");
      if (!section || !section.entries?.length) return null;
      const inner = renderEducationSection(section, finalVariant as any, order);
      return inner;
    }
    default: {
      // Generic section: certifications, awards, projects, publications, etc.
      const section = sections.find((s) => s.type === sectionType);
      if (!section || !section.entries?.length) return null;
      const inner = renderSection(section, { variant: finalVariant, order });
      return inner;
    }
  }
}

/**
 * Default variant per section type, chosen by area.
 * Deterministic — no inference.
 */
function getDefaultVariant(sectionType: string, area: "sidebar" | "main"): string {
  if (area === "sidebar") {
    switch (sectionType) {
      case "contacts": return "sidebar-stack";
      case "skills": return "grouped-pills";
      default: return "default";
    }
  }
  // main area defaults
  switch (sectionType) {
    case "experience": return "default";
    case "education": return "default";
    case "skills": return "grouped-pills";
    case "contacts": return "inline-minimal";
    default: return "default";
  }
}

/**
 * Wrap raw inner HTML in a semantic <section> with title.
 */
function wrapSection(innerHtml: string, sectionType: string, title: string): string {
  return `<section class="cv-section cv-section--${sectionType}" data-section-type="${sectionType}">
<h2 class="cv-section-title">${escapeHtml(title)}</h2>
${innerHtml}
</section>`;
}

/**
 * Compose the full HTML document.
 */
function composeDocument(
  cv: JsonCv,
  sidebarHtml: string,
  mainHtml: string,
  designState: DesignState,
  composition: DesignComposition
): string {
  const layoutId = designState.layoutId;
  const themeId = designState.themeId;
  const hasSidebar = sidebarHtml.length > 0;
  const sidebarClass = hasSidebar ? `cv-sidebar--active` : "";

  if (hasSidebar) {
    const isSidebarRight = layoutId === "sidebar-right";
    const bodyContent = isSidebarRight
      ? `<main class="cv-main">${mainHtml}</main>\n    <aside class="cv-sidebar">${sidebarHtml}</aside>`
      : `<aside class="cv-sidebar">${sidebarHtml}</aside>\n    <main class="cv-main">${mainHtml}</main>`;

    // Header contacts suppressed when contacts are placed in the layout (sidebar/main)
    const contactsInLayout = hasSectionInLayout("contacts", composition);
    const showHeaderContacts = !contactsInLayout;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(cv.name || "CV")}</title>
</head>
<body>
<div class="cv-page cv-layout--${layoutId} cv-theme--${themeId} ${sidebarClass}">
  <header class="cv-header">
    <h1 class="cv-name">${escapeHtml(cv.name || "")}</h1>
    ${cv.title ? `<p class="cv-title">${escapeHtml(cv.title)}</p>` : ""}
    ${(showHeaderContacts && cv.contact?.email) ? `<div class="cv-header-contacts">${cv.contact.email}${cv.contact.phone ? ` \u00b7 ${cv.contact.phone}` : ""}${cv.contact.linkedin ? ` \u00b7 ${cv.contact.linkedin}` : ""}${cv.contact.location ? ` \u00b7 ${cv.contact.location}` : ""}</div>` : ""}
  </header>
  <div class="cv-body">
    ${bodyContent}
  </div>
</div>
</body>
</html>`;
  }

  // Single-column layout
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(cv.name || "CV")}</title>
</head>
<body>
<div class="cv-page cv-layout--${layoutId} cv-theme--${themeId}">
  <header class="cv-header">
    <h1 class="cv-name">${escapeHtml(cv.name || "")}</h1>
    ${cv.title ? `<p class="cv-title">${escapeHtml(cv.title)}</p>` : ""}
  </header>
  ${(!hasSectionInLayout("contacts", composition) && cv.contact?.email) ? `<div class="cv-header-contacts">${cv.contact.email}${cv.contact.phone ? ` \u00b7 ${cv.contact.phone}` : ""}${cv.contact.linkedin ? ` \u00b7 ${cv.contact.linkedin}` : ""}${cv.contact.location ? ` \u00b7 ${cv.contact.location}` : ""}</div>` : ""}
  <main class="cv-main">${mainHtml}</main>
</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
