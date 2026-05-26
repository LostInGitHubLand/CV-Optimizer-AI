/**
 * Section Renderer — Contacts (with variants)
 *
 * Variants:
 *   - inline-minimal:    single-line comma-separated
 *   - sidebar-stack:     vertical stack with icons (default sidebar)
 *   - icon-grid:         grid of icon+label pairs
 *   - top-ribbon:        horizontal ribbon for header area
 */

import type { JsonCv } from "../../agents/writer";
import { escapeHtml, getContactIcon } from "../shared/utils";

export type ContactsVariant = "inline-minimal" | "sidebar-stack" | "icon-grid" | "top-ribbon";

export interface ContactItem {
  key: string;
  value: string;
  icon: string;
}

/**
 * Extract contact items from a JsonCv in a consistent order.
 */
export function extractContacts(cv: JsonCv): ContactItem[] {
  const items: ContactItem[] = [];
  const fields: { key: string; getter: () => string | undefined | null }[] = [
    { key: "email", getter: () => cv.contact?.email },
    { key: "phone", getter: () => cv.contact?.phone },
    { key: "linkedin", getter: () => cv.contact?.linkedin },
    { key: "github", getter: () => cv.contact?.github },
    { key: "portfolio", getter: () => cv.contact?.portfolio },
    { key: "location", getter: () => cv.contact?.location },
    { key: "website", getter: () => cv.contact?.website },
  ];
  for (const f of fields) {
    const v = f.getter();
    if (v) {
      const { icon } = getContactIcon(f.key);
      items.push({ key: f.key, value: v, icon });
    }
  }

  const known = new Set(fields.map((f) => f.key));

  for (const [key, value] of Object.entries(cv.contact ?? {})) {
    if (!value || known.has(key)) continue;

    const { icon } = getContactIcon(key);
    items.push({ key, value, icon });
  }

  return items;
}

export function renderContacts(
  items: ContactItem[],
  variant: ContactsVariant = "sidebar-stack"
): string {
  if (!items || items.length === 0) return "";

  switch (variant) {
    case "inline-minimal":
      return renderInlineMinimal(items);
    case "icon-grid":
      return renderIconGrid(items);
    case "top-ribbon":
      return renderTopRibbon(items);
    default:
      return renderSidebarStack(items);
  }
}

function renderSidebarStack(items: ContactItem[]): string {
  return `<div class="cv-contacts cv-contacts--stack">\n${items.map((c) =>
    `<div class="cv-contact" data-contact-type="${escapeHtml(c.key)}">` +
    `<span class="cv-contact-icon">${escapeHtml(c.icon)}</span>` +
    `<span class="cv-contact-value">${escapeHtml(c.value)}</span>` +
    `</div>`
  ).join("\n")}\n</div>`;
}

function renderInlineMinimal(items: ContactItem[]): string {
  const line = items.map((c) => `${escapeHtml(c.value)}`).join(" · ");
  return `<div class="cv-contacts cv-contacts--inline">${line}</div>`;
}

function renderIconGrid(items: ContactItem[]): string {
  return `<div class="cv-contacts cv-contacts--grid">\n${items.map((c) =>
    `<div class="cv-contact cv-contact--grid" data-contact-type="${escapeHtml(c.key)}">` +
    `<span class="cv-contact-icon">${escapeHtml(c.icon)}</span>` +
    `<span class="cv-contact-label">${escapeHtml(c.key)}</span>` +
    `<span class="cv-contact-value">${escapeHtml(c.value)}</span>` +
    `</div>`
  ).join("\n")}\n</div>`;
}

function renderTopRibbon(items: ContactItem[]): string {
  return `<div class="cv-contacts cv-contacts--ribbon">\n${items.map((c) =>
    `<span class="cv-contact cv-contact--ribbon" data-contact-type="${escapeHtml(c.key)}">` +
    `<span class="cv-contact-icon">${escapeHtml(c.icon)}</span>` +
    `<span class="cv-contact-value">${escapeHtml(c.value)}</span>` +
    `</span>`
  ).join("<span class='cv-contact-sep'> · </span>")}\n</div>`;
}
