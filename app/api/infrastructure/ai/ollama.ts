/**
 * Ollama Integration — Consolidated, Deduplicated, VRAM-Managed
 *
 * Architectural improvements vs. original:
 * 1. DESIGNER_PRO_MODEL removed — single source of truth for supported models.
 * 2. Unified VRAM unload — `unloadModel()` is the only unload function.
 *    `chatWithOllama` calls it *without await* when `unloadAfter` is true so the
 *    response is never delayed by a background housekeeping request.
 * 3. Shared /api/tags cache — `isOllamaAvailable` and `isModelAvailable` share
 *    a single cached response, cutting redundant HTTP calls by 50%.
 * 4. Centralised defaults — `chatWithOllama` owns all defaults;
 *    `queryOllama` is a thin pass-through wrapper with no redundant overrides.
 * 5. Strict 404 fallback guard — recursion only happens when the failed model
 *    is not already `DEFAULT_MODEL`.
 * 6. Dead-code removal — `switchModel` (unused), `maxTokens` (never wired),
 *    and `fireUnloadRequest` (merged into `unloadModel`) are gone.
 */

import { env } from "../../shared/env";
import type { Logger } from "../logging/logger";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const OLLAMA_HOST = env.ollamaHost;
const DEFAULT_MODEL = "qwen3";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful AI assistant.";

// Global defaults for chatWithOllama (single source of truth)
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 min — accommodates model-load overhead
const DEFAULT_KEEP_ALIVE = 300;
const DEFAULT_NUM_CTX = 8192;

// Cache TTL for /api/tags (shared between availability checks)
const TAGS_CACHE_TTL_MS = 5000;

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

export type OllamaModel = "qwen3" | "qwen2.5-coder:7b";

interface OllamaResponse {
  response?: string;
  done?: boolean;
  eval_count?: number;        // tokens generated in response
  prompt_eval_count?: number; // tokens in prompt
  eval_duration?: number;      // nanoseconds spent generating
  prompt_eval_duration?: number; // nanoseconds spent evaluating prompt
  total_duration?: number;      // total nanoseconds for the entire request
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. SHARED /api/tags CACHE — Consolidated Health & Model Checks
   ═══════════════════════════════════════════════════════════════════════════ */

interface TagsCache {
  models: Array<{ name: string }>;
  timestamp: number;
}

let tagsCache: TagsCache | null = null;

/**
 * Fetches /api/tags with a 5-second in-memory cache.
 * Both `isOllamaAvailable` and `isModelAvailable` use this, eliminating
 * redundant HTTP requests when called in quick succession.
 */
async function fetchTagsCached(): Promise<TagsCache | null> {
  const now = Date.now();
  if (tagsCache && now - tagsCache.timestamp < TAGS_CACHE_TTL_MS) {
    return tagsCache;
  }
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const cacheEntry: TagsCache = {
      models: data.models || [],
      timestamp: now,
    };
    tagsCache = cacheEntry;
    return cacheEntry;
  } catch {
    return null;
  }
}

/** Returns true if Ollama server is reachable. Uses shared tags cache. */
export async function isOllamaAvailable(): Promise<boolean> {
  const cache = await fetchTagsCached();
  return cache !== null;
}

/**
 * Returns true if the requested model is present in Ollama.
 * Uses the same shared tags cache as `isOllamaAvailable`.
 */
export async function isModelAvailable(model: OllamaModel): Promise<boolean> {
  const cache = await fetchTagsCached();
  if (!cache) return false;
  return cache.models.some(
    (m) => m.name === model || m.name.startsWith(model)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. CORE GENERATION — chatWithOllama (single source of defaults)
   ═══════════════════════════════════════════════════════════════════════════ */

export interface ChatOptions {
  model?: OllamaModel;
  keepAlive?: number;
  temperature?: number;
  timeout?: number;
  unloadAfter?: boolean;
  log?: Logger;
  onTokens?: (promptTokens: number, genTokens: number) => void;
}

/**
 * Single-turn generation to Ollama.
 *
 * Default hierarchy (all defined HERE, nowhere else):
 *   model       → DEFAULT_MODEL ("qwen3")
 *   temperature → 0.7
 *   timeout     → 300_000 ms (5 min)
 *   keepAlive   → 300
 *   num_ctx     → 8192
 *
 * @param options.unloadAfter — If true, `unloadModel()` is fired *without
 *   await* after the response is received. This drops the model from VRAM
 *   in the background and never delays the caller.
 */
export async function chatWithOllama(
  systemPrompt: string,
  userPrompt: string,
  options: ChatOptions = {}
): Promise<string> {
  const model = options.model || DEFAULT_MODEL;
  const keepAlive = options.keepAlive ?? DEFAULT_KEEP_ALIVE;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
        options: { temperature, num_ctx: DEFAULT_NUM_CTX },
        keep_alive: keepAlive,
      }),
    });

    if (!response.ok) {
      // 5. ROBUST FALLBACK — only recurse if we are NOT already on DEFAULT_MODEL
      if (response.status === 404 && model !== DEFAULT_MODEL) {
        const fallbackMsg = `Model "${model}" not found, falling back to "${DEFAULT_MODEL}"`;
        if (options.log) options.log.warn("OLLAMA", fallbackMsg);
        return chatWithOllama(systemPrompt, userPrompt, {
          ...options,
          model: DEFAULT_MODEL,
          log: options.log,
        });
      }
      throw new Error(`Ollama HTTP error: ${response.status}`);
    }

    const data = (await response.json()) as OllamaResponse;
    const answer = data.response?.trim() || "";

    // Log token metrics via structured logger + optional callback for pipeline metrics
    if (data.eval_count !== undefined) {
      const p = data.prompt_eval_count ?? 0;
      const g = data.eval_count ?? 0;
      const t = p + g;
      const genMs = data.eval_duration ? Math.round(data.eval_duration / 1_000_000) : 0;
      const promptMs = data.prompt_eval_duration ? Math.round(data.prompt_eval_duration / 1_000_000) : 0;
      const totalMs = data.total_duration ? Math.round(data.total_duration / 1_000_000) : 0;
      const tokenMsg = `Tokens: P:${p} G:${g} T:${t} | LLM Time: ${totalMs}ms (prompt ${promptMs}ms + gen ${genMs}ms)`;
      if (options.log) options.log.info("OLLAMA", tokenMsg);
      else console.log(`[OLLAMA] ${tokenMsg}`);
      // Report tokens upstream for pipeline completion report
      if (options.onTokens) options.onTokens(p, g);
    }

    // ── 2. VRAM UNLOAD (background, intentionally non-blocking) ──────────
    if (options.unloadAfter) {
      unloadModel(model); // NO await — must not delay the response
    }

    return answer;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Ollama timed out after ${timeoutMs / 1000}s. Model "${model}" may still be loading into VRAM. Increase timeout or check GPU memory.`
      );
    }
    const errMsg = `Failed to communicate with Ollama: ${error instanceof Error ? error.message : "Unknown error"}`;
    if (options.log) options.log.error("OLLAMA", errMsg);
    else console.error("[OLLAMA] Chat error:", error);
    throw new Error(errMsg);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. UNIFIED VRAM UNLOAD — single function, shared by all callers
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Unloads a model from VRAM via `keep_alive: 0`.
 *
 * • Called **with** await by `unloadAllModels` (explicit shutdown).
 * • Called **without** await by `chatWithOllama` (background, non-blocking).
 *
 * The function is fire-and-forget safe: `.catch()` absorbs network errors
 * so callers never crash because of a failed background unload.
 */
export async function unloadModel(model?: OllamaModel): Promise<void> {
  const target = model || DEFAULT_MODEL;
  try {
    await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        model: target,
        prompt: "",
        keep_alive: 0,
      }),
    });
    console.log(`[VRAM] Unloaded "${target}" from VRAM`);
  } catch (err) {
    console.warn(
      `[VRAM] Background unload for "${target}" failed:`,
      err instanceof Error ? err.message : err
    );
  }
}

/** Unload both supported models. Used during "I'm so satisfied" finalization. */
export async function unloadAllModels(): Promise<void> {
  await unloadModel("qwen3");
  await unloadModel("qwen2.5-coder:7b");
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. THIN WRAPPERS — no redundant defaults, pass-through only
   ═══════════════════════════════════════════════════════════════════════════ */

export interface QueryOllamaOptions {
  prompt: string;
  system?: string;
  model?: OllamaModel;
  temperature?: number;
  unloadAfter?: boolean;
  log?: Logger;
  onTokens?: TokenReporter;
}

/**
 * Thin wrapper over `chatWithOllama`. Does NOT redeclare defaults that are
 * already centralised in `chatWithOllama` (temperature, timeout, etc.).
 *
 * Previously redundant overrides removed:
 *   - `timeout: 300_000`  → already the default in chatWithOllama
 *   - `temperature ?? 0.3` → caller passes what it wants; fallback is 0.7 upstream
 *   - `maxTokens` → dead parameter, never wired to the Ollama API, removed
 */
export async function queryOllama(
  options: QueryOllamaOptions
): Promise<string> {
  return chatWithOllama(
    options.system || DEFAULT_SYSTEM_PROMPT,
    options.prompt,
    {
      model: options.model || DEFAULT_MODEL,
      temperature: options.temperature,
      unloadAfter: options.unloadAfter,
      log: options.log,
      onTokens: options.onTokens,
    }
  );
}

/** Callback to report token usage upstream for pipeline metrics. */
export type TokenReporter = (promptTokens: number, genTokens: number) => void;

export interface ChatWithOllamaJSONOptions extends ChatOptions {
  log?: Logger;
}

/**
 * JSON-mode wrapper. Instructs the model to emit pure JSON, cleans markdown
 * fences, and parses safely.
 *
 * Timeout is inherited from chatWithOllama's default (300_000 ms) unless
 * explicitly overridden.
 */
export async function chatWithOllamaJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options: ChatWithOllamaJSONOptions = {}
): Promise<T> {
  const response = await chatWithOllama(
    `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any markdown formatting, explanations, or code blocks. Only pure JSON.`,
    userPrompt,
    { ...options, log: options.log }
  );

  const cleaned = response
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .replace(/^\s*\{\s*/g, "{")
    .replace(/\s*\}\s*$/g, "}")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    throw new Error(
      `Failed to parse JSON response: ${e instanceof Error ? e.message : "Unknown error"}`
    );
  }
}

/* Re-export DEFAULT_MODEL for consumers that need it */
export { DEFAULT_MODEL };
