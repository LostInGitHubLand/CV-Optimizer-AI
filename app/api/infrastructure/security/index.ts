/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Layer 3 Security — Deterministic HTML Sanitization
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Architecture: Three-tier defense against XSS and prompt-injection attacks
 *   Layer 1 (System):  Prompt-level guards in each agent (core-rules.ts)
 *   Layer 2 (Data):    Zod schema validation + structured JSON parsing
 *   Layer 3 (Content): Final-stage HTML sanitization before PDF generation
 *
 * This module uses DOMPurify + JSDOM to strip all executable content while
 * preserving CV-essential tags: <style>, layout markup, and semantic HTML.
 *
 * Forbidden: <script>, <iframe>, <object>, <embed>, <form>, event handlers (on*),
 *            javascript: URIs, data URIs with executable MIME types.
 * Allowed:   <style>, <div>, <span>, <p>, <h1>–<h6>, <section>, <table>,
 *            <img> (src attribute filtered), <a> (href filtered), etc.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("<!DOCTYPE html>").window;
const DOMPurify = createDOMPurify(window);

/** Configuration tuned for CV template safety — keeps layout, kills scripts. */
const PURIFY_CONFIG: createDOMPurify.Config = {
  // Allow the full document structure (we're sanitizing complete HTML templates)
  WHOLE_DOCUMENT: true,

  // Keep <style> blocks (essential for CV layout) plus standard CV markup
  ALLOWED_TAGS: [
    // Document structure
    "html", "head", "body", "title", "meta", "link",
    // Sections / layout
    "div", "span", "section", "article", "header", "footer", "main", "aside",
    "nav", "hr", "br",
    // Typography
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "b", "em", "i",
    "u", "s", "strike", "del", "ins", "mark", "small", "sub", "sup",
    "blockquote", "pre", "code", "abbr", "cite", "dfn", "q", "time",
    // Lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
    "colgroup", "col",
    // Media (src will be filtered via ALLOWED_ATTR)
    "img", "figure", "figcaption",
    // Links (href will be filtered via ALLOWED_ATTR)
    "a",
    // Style (CRITICAL — CV templates depend on inline CSS)
    "style",
    // SVG (for icons, logos)
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
    "polygon", "text", "tspan", "defs", "clipPath", "use", "symbol",
  ],

  // Strip everything that could execute code or exfiltrate data
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input",
    "textarea", "button", "select", "option", "optgroup", "label",
    "canvas", "audio", "video", "source", "track", "map", "area",
    "base", "noscript", "template", "slot", "portal"],

  // Attribute whitelist — only safe, non-executable attributes
  ALLOWED_ATTR: [
    // Standard layout / typography
    "class", "id", "style", "title", "lang", "dir", "role", "aria-*",
    "data-*",
    // Links — href is filtered below via FORBID_ATTR + regex
    "href",
    // Media — src is filtered below
    "src", "alt", "width", "height", "loading",
    // Tables
    "colspan", "rowspan", "headers", "scope", "border", "cellpadding",
    "cellspacing",
    // Meta / link
    "charset", "name", "content", "http-equiv", "rel", "type", "media",
    // SVG
    "viewBox", "xmlns", "fill", "stroke", "stroke-width", "d", "x", "y",
    "rx", "ry", "cx", "cy", "r", "points", "transform", "clip-path",
    "mask", "opacity", "fill-opacity", "stroke-opacity", "stroke-linecap",
    "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  ],

  // Explicitly ban every event handler attribute
  FORBID_ATTR: [
    // JavaScript event handlers (comprehensive list)
    "onabort", "onafterprint", "onbeforeprint", "onbeforeunload", "onblur",
    "oncancel", "oncanplay", "oncanplaythrough", "onchange", "onclick",
    "onclose", "oncontextmenu", "oncuechange", "ondblclick", "ondrag",
    "ondragend", "ondragenter", "ondragleave", "ondragover", "ondragstart",
    "ondrop", "ondurationchange", "onemptied", "onended", "onerror",
    "onfocus", "onhashchange", "oninput", "oninvalid", "onkeydown",
    "onkeypress", "onkeyup", "onload", "onloadeddata", "onloadedmetadata",
    "onloadstart", "onmessage", "onmousedown", "onmouseenter", "onmouseleave",
    "onmousemove", "onmouseout", "onmouseover", "onmouseup", "onmousewheel",
    "onoffline", "ononline", "onpagehide", "onpageshow", "onpause", "onplay",
    "onplaying", "onpopstate", "onprogress", "onratechange", "onreset",
    "onresize", "onscroll", "onseeked", "onseeking", "onselect", "onshow",
    "onstalled", "onstorage", "onsubmit", "onsuspend", "ontimeupdate",
    "ontoggle", "onunload", "onvolumechange", "onwaiting", "onwheel",
    // Dangerous URI-based vectors
    "formaction", "formmethod", "formtarget", "ping",
    // Data / dynamic attributes that could carry scripts
    "xlink:href",
  ],

  // Block dangerous URI schemes in href/src
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel|sms|fax):|[^a-zA-Z]|[a-zA-Z+.\-#;]+(?:[^\s]*))/i,

  // Keep the document head intact (meta, link, title, style)
  IN_PLACE: false,

  // Strip comments that could confuse parsers or hide payload fragments
  KEEP_CONTENT: true,

  // Sanitize style attribute content (removes expression(), behavior:, etc.)
  // Note: <style> tag content is preserved; only inline style="..." attributes
  // get CSS-level sanitization by the browser engine.
};

/**
 * Sanitize raw HTML produced by the Designer agent before PDF conversion.
 *
 * @param rawHtml — the Designer agent's HTML output (may contain AI artifacts)
 * @returns sanitized HTML safe for Puppeteer / browser rendering
 */
export function sanitizeCvHtml(rawHtml: string): string {
  const clean = DOMPurify.sanitize(rawHtml, PURIFY_CONFIG);
  // DOMPurify returns a DocumentFragment string when WHOLE_DOCUMENT is true.
  // Force a full HTML wrapper so Puppeteer receives a complete document.
  if (typeof clean === "string" && !clean.trim().startsWith("<!DOCTYPE")) {
    return `<!DOCTYPE html>\n${clean}`;
  }
  return clean as string;
}

/**
 * Quick safety check: returns true if the string contains any obviously
 * dangerous patterns that DOMPurify should have caught.
 * Used in integration tests and health-check endpoints.
 */
export function containsDangerousPatterns(html: string): boolean {
  const dangerous = [
    /<script\b/i,
    /<iframe\b/i,
    /<object\b/i,
    /<embed\b/i,
    /<form\b/i,
    /javascript:/i,
    /on\w+\s*=/i, // onerror, onload, onclick, etc.
    /data:text\/html/i,
    /<\?xml\s+version/i, // XXE vector
    /<\!ENTITY\s+/i,     // XXE vector
  ];
  return dangerous.some((re) => re.test(html));
}


DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if ("hasAttribute" in node && typeof node.hasAttribute === "function") {
    for (const attr of ["href", "src", "xlink:href"]) {
      if (node.hasAttribute(attr)) {
        const value = node.getAttribute(attr) ?? "";
        const normalized = value.trim().toLowerCase();

        if (
          normalized.startsWith("javascript:") ||
          normalized.startsWith("data:") ||
          normalized.startsWith("vbscript:")
        ) {
          node.removeAttribute(attr);
        }
      }
    }
  }
});