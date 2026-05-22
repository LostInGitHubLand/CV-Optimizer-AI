/**
 * Shared template utilities — used by mustache-engine.ts and templates/index.ts
 * Centralized to eliminate code duplication across the rendering layer.
 */

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function isTruthy(val: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val).length > 0;
  return true;
}

export function resolvePath(ctx: Record<string, unknown>, key: string): unknown {
  if (key === "this") return ctx["this"];
  if (key in ctx) return ctx[key];
  if (key.includes(".")) {
    const parts = key.split(".");
    let current: unknown = ctx;
    for (const part of parts) {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }
  return undefined;
}

/* ── Icon mapping for known contact fields ───────────────────────────────── */

export interface ContactIconMeta {
  icon: string;
  faClass: string;
}

export const CONTACT_ICONS: Record<string, ContactIconMeta> = {
  email:     { icon: "✉",  faClass: "fas fa-envelope" },
  phone:     { icon: "📞", faClass: "fas fa-phone" },
  linkedin:  { icon: "🔗", faClass: "fab fa-linkedin" },
  location:  { icon: "📍", faClass: "fas fa-map-marker-alt" },
  github:    { icon: "⚙",  faClass: "fab fa-github" },
  gitlab:    { icon: "🦊", faClass: "fab fa-gitlab" },
  website:   { icon: "🌐", faClass: "fas fa-globe" },
  portfolio: { icon: "🎨", faClass: "fas fa-palette" },
  twitter:   { icon: "𝕏",  faClass: "fab fa-x-twitter" },
  x:         { icon: "𝕏",  faClass: "fab fa-x-twitter" },
  kaggle:    { icon: "📊", faClass: "fas fa-chart-bar" },
  behance:   { icon: "🅱️", faClass: "fab fa-behance" },
  dribbble:  { icon: "🏀", faClass: "fab fa-dribbble" },
  medium:    { icon: "📝", faClass: "fab fa-medium" },
};

export function getContactIcon(key: string): ContactIconMeta {
  return CONTACT_ICONS[key.toLowerCase()] || { icon: "◆", faClass: "fas fa-link" };
}
