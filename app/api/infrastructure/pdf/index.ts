/**
 * PDF Utility Module — Performance & Security Optimized
 *
 * Works in both production (esbuild bundle with global require banner)
 * and dev (Vite with no global require).
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import type { Browser, Page } from "puppeteer";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

/* ═══════════════════════════════════════════════════════════════════════════
   PATH CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");

/* ═══════════════════════════════════════════════════════════════════════════
   1. FILE SYSTEM — Singleton Promise Cache
   ═══════════════════════════════════════════════════════════════════════════ */

let uploadDirPromise: Promise<string> | null = null;

/**
 * Ensures the upload directory exists. The underlying `fs.mkdir` promise is
 * cached for the module lifecycle so redundant file-system hits are avoided.
 * Node.js natively handles already-existing directories when `{ recursive: true }`
 * is passed, so no try/catch suppression is necessary.
 */
export function ensureUploadDir(): Promise<string> {
  if (!uploadDirPromise) {
    uploadDirPromise = fs.mkdir(UPLOAD_DIR, { recursive: true }).then(() => UPLOAD_DIR);
  }
  return uploadDirPromise;
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. SECURITY — UUID Prefix + Robust Filename Sanitization
   ═══════════════════════════════════════════════════════════════════════════ */

// Characters that are illegal in Windows / Unix filenames plus path traversal.
const ILLEGAL_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

// Explicit path-traversal patterns (.., backslashes, absolute markers).
const PATH_TRAVERSAL_PATTERN = /^(\.\.)|[:\\/|<>?*\x00-\x1f]|\.{2,}/;

/**
 * Sanitizes a user-supplied filename to prevent Path Traversal and ensure
 * cross-platform compatibility.
 *  - Strips control characters, path separators, and shell metacharacters.
 *  - Rejects ".." prefixes and absolute-path markers.
 *  - Limits length to mitigate buffer-overflow edge cases in legacy tools.
 */
function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (PATH_TRAVERSAL_PATTERN.test(trimmed)) {
    // If traversal is attempted, drop the unsafe prefix and fall back to a generic name.
    return "unsafe_upload.pdf";
  }
  const normalized = trimmed.replace(ILLEGAL_FILENAME_CHARS, "_");
  return normalized.length > 200 ? normalized.slice(0, 200) : normalized;
}

/* ────────────────────────────────────────────────────────────────────────── */

export interface SavePdfFileOptions {
  /** Optional explicit filename override (only used with Buffer input). */
  filename?: string;
}

/**
 * Saves a PDF to the uploads directory.
 * Accepts either a File-like object (with `name` + `arrayBuffer()`) or a raw Buffer.
 *
 * Security: every file is prefixed with `crypto.randomUUID()` so collisions are
 * cryptographically impossible, even under high concurrency.
 */
export async function savePdfFile(
  file: { name: string; arrayBuffer(): Promise<ArrayBuffer> } | Buffer,
  options: SavePdfFileOptions = {}
): Promise<string> {
  const uploadDir = await ensureUploadDir();

  let buffer: Buffer;
  let safeName: string;

  if (Buffer.isBuffer(file)) {
    // Called with (buffer, options)
    buffer = file;
    safeName = `${randomUUID()}_${sanitizeFilename(options.filename || "upload.pdf")}`;
  } else {
    // Called with File object
    const arr = await file.arrayBuffer();
    buffer = Buffer.from(arr);
    safeName = `${randomUUID()}_${sanitizeFilename(file.name)}`;
  }

  const filePath = path.join(uploadDir, safeName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. PERSISTENT BROWSER — Singleton + Page Reuse Pattern
   ═══════════════════════════════════════════════════════════════════════════ */

let browserPromise: Promise<Browser> | null = null;

/**
 * Returns a reusable Browser singleton. Launches lazily on first call.
 * Keeps the browser alive across multiple PDF generations, eliminating
 * the heavy Chrome startup/teardown overhead (~300-600 ms per call).
 *
 * Args tuned for headless/server environments:
 *   --disable-gpu         → GPU compositing is unnecessary for PDF output.
 *   --no-sandbox          → Required for Docker / restricted environments.
 *   --disable-setuid-sandbox
 *   --disable-dev-shm-usage
 */
async function getBrowser(): Promise<Browser> {
  // If we have a cached browser, verify it's still alive
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (await isBrowserAlive(browser)) {
        return browser;
      }
      // Browser is dead — reset and relaunch
      resetBrowser();
    } catch {
      resetBrowser();
    }
  }

  const { default: puppeteer } = await import("puppeteer");
  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  return browserPromise;
}

/**
 * Check if the browser connection is still alive.
 * Puppeteer's browser.process() returns null if the child process has exited.
 * browser.version() throws if the WebSocket connection is dead.
 */
async function isBrowserAlive(browser: Browser): Promise<boolean> {
  try {
    // Fast check: is the child process still running?
    const proc = browser.process();
    if (!proc || proc.exitCode !== null) return false;
    // Definitive check: can we talk to Chrome over the WebSocket?
    await browser.version();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully closes the shared browser instance. Call during server shutdown
 * or test teardown to release OS resources.
 */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (await isBrowserAlive(browser)) {
        await browser.close();
      }
    } catch {
      // Swallow — browser is already dead
    }
    browserPromise = null;
  }
}

/**
 * Resets the browser promise so the next call to getBrowser() launches a fresh instance.
 * Use this when you detect the browser connection has died.
 */
function resetBrowser(): void {
  browserPromise = null;
}

// Page-level margin presets keyed by template.
const MARGIN_MAP: Record<
  string,
  { top: string; right: string; bottom: string; left: string }
> = {
  minimal: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
  default: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },  // backward compat
  legal:   { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
  neo:     { top: "12mm", right: "14mm", bottom: "12mm", left: "14mm" },
  creative:{ top: "0",    right: "0",    bottom: "0",    left: "0" },
};

/**
 * Generates a PDF from HTML using a persistent Puppeteer browser instance.
 *
 * Performance:
 *   - Browser is reused; only a new Page is created per call.
 *   - waitUntil: "domcontentloaded" because Designer inlines all CSS — no
 *     external assets need to finish loading. Cuts render time significantly.
 *
 * @throws Error with origin context if PDF generation fails.
 */
/**
 * Generates a PDF from HTML using a persistent Puppeteer browser instance.
 *
 * Performance:
 *   - Browser is reused; only a new Page is created per call.
 *   - waitUntil: "domcontentloaded" because Designer inlines all CSS — no
 *     external assets need to finish loading. Cuts render time significantly.
 *
 * Resilience:
 *   - If the browser connection dies mid-render, resets and retries once.
 *   - Health-checked on every call to detect stale browser processes.
 *
 * @throws Error with origin context if PDF generation fails (after retries).
 */
export async function convertHtmlToPdf(
  html: string,
  pdfPath: string,
  layoutId: string = "single-column"
): Promise<void> {
  const MAX_RETRIES = 1;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let page: Page | undefined;

    try {
      const browser = await getBrowser();
      page = await browser.newPage();

      // domcontentloaded is sufficient: Designer embeds all styles inline.
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      // Canonical layout IDs → margin presets
      const layoutMargins: Record<string, typeof MARGIN_MAP.default> = {
        "single-column":   MARGIN_MAP.minimal,
        "sidebar-left":    MARGIN_MAP.neo,
        "sidebar-right":   MARGIN_MAP.legal,
        "": MARGIN_MAP.creative,
      };
      const margins = layoutMargins[layoutId] ?? MARGIN_MAP.default;

      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: margins,
      });

      return; // Success — exit
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      lastError = new Error(`[PDF] Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${message}`, { cause });

      // If it's a connection error, reset browser for retry
      if (message.includes("Connection closed") || message.includes("Protocol")) {
        resetBrowser();
      }
    } finally {
      // Close only the Page — never the shared Browser.
      if (page) {
        await page.close().catch(() => {}); // silently absorb close errors
      }
    }
  }

  // All retries exhausted
  throw lastError ?? new Error("[PDF] Puppeteer generation failed after all retries");
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. PDF TEXT EXTRACTION — pdfjs-dist (Modern ESM Alternative)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Resolve the pdfjs-dist worker path. Works in both:
 *   - Production: esbuild banner injects global `require`
 *   - Dev (Vite): no global `require`, so we dynamically import `createRequire`
 */
async function resolveWorkerPath(): Promise<string> {
  try {
    // In production bundle, esbuild banner injects global `require`
    return (require as NodeJS.Require).resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  } catch {
    // In Vite dev mode, `require` is not available — create our own dynamically
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    return req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }
}

/**
 * Extracts plain text from a PDF file using Mozilla's pdfjs-dist.
 */
export async function extractTextFromPdf(filePath: string): Promise<string> {
  let dataBuffer: Buffer;
  try {
    dataBuffer = await fs.readFile(filePath);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`[PDF] Failed to read file "${filePath}": ${message}`, { cause });
  }

  try {
    const workerPath = await resolveWorkerPath();
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

    // Convert Buffer → Uint8Array (pdfjs-dist requires strict Uint8Array, not Buffer)
    const uint8Data = new Uint8Array(dataBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: uint8Data });
    const pdfDocument = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const strings = textContent.items
        .map((item) => (item as { str: string }).str)
        .filter((s): s is string => typeof s === "string");
      pageTexts.push(strings.join(" "));
      // Release page resources eagerly.
      await page.cleanup();
    }

    return pageTexts.join("\n").trim();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`[PDF] Text extraction failed for "${filePath}": ${message}`, { cause });
  }
}
