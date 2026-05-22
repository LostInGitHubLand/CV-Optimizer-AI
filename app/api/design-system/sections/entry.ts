/**
 * Section Renderer — Entry
 *
 * Renders a single CV entry (experience, education, certification, project, award, publication).
 * Pure semantic HTML. No layout assumptions. No theme assumptions. No inline styles.
 *
 * Output: generic CSS class names (cv-entry, cv-entry-header, etc.)
 * Themes control visual appearance through CSS variable tokens.
 */

import { escapeHtml } from "../shared/utils";

export interface EntryData {
  heading: string;
  subheading?: string;
  date?: string;
  description?: string;
  grade?: string;
  bullets?: string[];
}

/**
 * Render a single CV entry as semantic HTML.
 * Generic class names. Zero visual styling. Zero template coupling.
 */
export function renderEntry(entry: EntryData): string {
  const h = escapeHtml(entry.heading || "");
  const s = escapeHtml(entry.subheading || "");
  const d = escapeHtml(entry.date || "");
  const desc = escapeHtml(entry.description || "");
  const g = entry.grade ? escapeHtml(entry.grade) : "";
  const bullets = entry.bullets && entry.bullets.length
    ? `<ul class="cv-entry-bullets">${entry.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";

  return [
    '<div class="cv-entry">',
    '<div class="cv-entry-header">',
    h ? `<span class="cv-entry-title">${h}</span>` : "",
    d ? `<span class="cv-entry-dates">${d}</span>` : "",
    "</div>",
    s ? `<div class="cv-entry-subtitle">${s}</div>` : "",
    desc ? `<div class="cv-entry-description">${desc}</div>` : "",
    g ? `<div class="cv-entry-grade">${g}</div>` : "",
    bullets,
    "</div>",
  ].join("\n");
}

/**
 * Render a certification entry (slightly richer: includes description + bullets).
 */
export function renderCertEntry(entry: EntryData): string {
  const h = escapeHtml(entry.heading || "");
  const s = escapeHtml(entry.subheading || "");
  const d = escapeHtml(entry.date || "");
  const desc = entry.description ? escapeHtml(entry.description) : "";
  const bullets = entry.bullets && entry.bullets.length
    ? `<ul class="cv-entry-bullets">${entry.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";

  return [
    '<div class="cv-entry" data-entry-type="certification">',
    '<div class="cv-entry-header">',
    h ? `<span class="cv-entry-title">${h}</span>` : "",
    d ? `<span class="cv-entry-dates">${d}</span>` : "",
    "</div>",
    s ? `<div class="cv-entry-subtitle">${s}</div>` : "",
    desc ? `<div class="cv-entry-description">${desc}</div>` : "",
    bullets,
    "</div>",
  ].join("\n");
}

/**
 * Render an award/honor entry.
 */
export function renderAwardEntry(entry: EntryData): string {
  const h = escapeHtml(entry.heading || "");
  const s = escapeHtml(entry.subheading || "");
  const d = escapeHtml(entry.date || "");

  return [
    '<div class="cv-entry" data-entry-type="award">',
    '<div class="cv-entry-header">',
    h ? `<span class="cv-entry-title">${h}</span>` : "",
    d ? `<span class="cv-entry-dates">${d}</span>` : "",
    "</div>",
    s ? `<div class="cv-entry-subtitle">${s}</div>` : "",
    "</div>",
  ].join("\n");
}
