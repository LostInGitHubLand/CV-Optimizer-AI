/**
 * Data Integrity Utilities
 *
 * Shared across Analyst (ensureKept) and Writer (TraceReport, smartPrune).
 * Pure functions; no agent-specific logic lives here.
 */

import type { JsonProfile } from "../../src/lib/validations/cv.schema";
import type { Domain } from "./industry-config";
import { IndustryConfig } from "./industry-config";

/* ═══════════════════════════════════════════════════════════════════
   1. GENERIC ensureKept — data-recovery utility
   ═══════════════════════════════════════════════════════════════════ */

export interface KeptItem {
  index: number;
  [key: string]: unknown;
}

/**
 * Ensure every index in the source profile array has a corresponding
 * entry in the keep array.  Missing items are auto-recreated with a
 * default builder so the AI cannot accidentally drop sections.
 *
 * @param profileArray  Source array from JsonProfile (e.g. experience[])
 * @param keepArray     Target array from AI response (e.g. keep.experience[])
 * @param build         Factory that creates a fallback item for index `i`
 * @param sectionName   Human-readable section key for reporting
 * @param recovered     Out-param: mutated to count how many items were rescued
 */
export function ensureKept<T extends KeptItem>(
  profileArray: Array<unknown>,
  keepArray: T[],
  build: (idx: number) => T,
  sectionName: string,
  recovered: Record<string, number>
): void {
  if (!profileArray?.length) return;
  let count = 0;
  for (let i = 0; i < profileArray.length; i++) {
    if (!keepArray.some((k) => k.index === i)) {
      keepArray.push(build(i));
      count++;
    }
  }
  if (count > 0) {
    recovered[sectionName] = (recovered[sectionName] ?? 0) + count;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   2. TRACE REPORT — observability structure
   ═══════════════════════════════════════════════════════════════════ */

export interface TraceReport {
  pipeline: "AI" | "rule-based";
  /** Raw LLM response (before Zod validation) */
  rawResponse: unknown | null;
  /** Whether Zod validation succeeded */
  validationPassed: boolean;
  /** Serialised Zod error.format() when validation fails */
  validationErrors: string | null;
  /** Sections → number of items rescued by ensureKept */
  recovered: Record<string, number>;
  /** Sections → { profileCount, keptCount } coverage stats */
  coverage: Record<string, { profile: number; kept: number }>;
}

export function createTraceReport(pipeline: "AI" | "rule-based" = "AI"): TraceReport {
  return {
    pipeline,
    rawResponse: null,
    validationPassed: true,
    validationErrors: null,
    recovered: {},
    coverage: {},
  };
}

export function sanitizeJsonCv(jsonCv: unknown): Record<string, unknown> {
  if (!jsonCv || typeof jsonCv !== "object") return { name: "", title: "", contact: {}, summary: "", sections: [], skills: { categories: [] }, metadata: { targetRole: "", tone: "", emphasis: [] } };
  const cv = JSON.parse(JSON.stringify(jsonCv)) as Record<string, unknown>;
  // Ensure all mandatory fields exist
  if (!cv.name) cv.name = "";
  if (!cv.title) cv.title = "";
  if (!cv.contact || typeof cv.contact !== "object") cv.contact = {};
  if (!cv.summary) cv.summary = "";
  if (!Array.isArray(cv.sections)) cv.sections = [];
  if (!cv.skills || typeof cv.skills !== "object") cv.skills = { categories: [] };
  if (!cv.metadata || typeof cv.metadata !== "object") cv.metadata = { targetRole: "", tone: "", emphasis: [] };
  // Strip undefined from all strings
  for (const key of Object.keys(cv)) {
    if (typeof cv[key] === "string" && cv[key] === "undefined") cv[key] = "";
  }
  return cv;
}

export function validateWriterOutput(result: unknown): void {
  if (!result || typeof result !== "object") throw new Error("Writer output is not an object");
  const r = result as Record<string, unknown>;
  if (typeof r.markdown !== "string") throw new Error("Writer output missing markdown");
  if (!r.jsonCv || typeof r.jsonCv !== "object") throw new Error("Writer output missing jsonCv");
  const jsonCv = r.jsonCv as Record<string, unknown>;
  if (!Array.isArray(jsonCv.sections)) throw new Error("jsonCv.sections must be an array");
}

import type { Logger } from "../infrastructure/logging/logger";

export function logTraceReport(report: TraceReport, log: Logger): void {
  log.info("INTEGRITY", `═══════ ${report.pipeline} Trace Report ═══════`);
  log.info("INTEGRITY", `Validation : ${report.validationPassed ? "PASSED" : "FAILED"}`);
  if (report.validationErrors) {
    log.warn("INTEGRITY", `Zod errors :\n${report.validationErrors}`);
  }
  log.info("INTEGRITY", `Recovered  : ${JSON.stringify(report.recovered)}`);
  log.info("INTEGRITY", `Coverage   : ${JSON.stringify(report.coverage)}`);
  log.info("INTEGRITY", "════════════════════════════════════════");
}

/* ═══════════════════════════════════════════════════════════════════
   3. SMART PRUNING — Summary Mode token management
   ═══════════════════════════════════════════════════════════════════ */

const MAX_AI_INPUT_CHARS = 8000;

/** Extract a one-sentence summary from a longer description.
 *  Picks the first sentence; falls back to first clause. */
export function oneSentenceSummary(text: string): string {
  if (!text || text.length < 80) return text;
  const firstSentence = text.match(/^[^.!?]+[.!?]/);
  if (firstSentence) return firstSentence[0].trim();
  return text.substring(0, 100).trim() + "...";
}

/** Token-conscious pruning with Summary Mode.
 *
 *  Strategy (highest → lowest priority):
 *    1. Drop lowest-priority sections per domain config
 *    2. Summary Mode: collapse experience descriptions to one sentence
 *    3. Truncate remaining descriptions to 120 chars
 *
 *  The timeline stays intact; only verbosity is reduced.
 *
 *  @param domain  Optional domain for domain-aware section priorities.
 *                 Medical prioritises certifications + publications;
 *                 Legal prioritises certifications + education;
 *                 Creative prioritises projects + publications.
 */
export function smartPrune(profile: JsonProfile, domain?: Domain): Record<string, unknown> {
  const serialised = JSON.stringify(profile);
  if (serialised.length <= MAX_AI_INPUT_CHARS) return profile as Record<string, unknown>;

  const pruned: Record<string, unknown> = JSON.parse(serialised);

  // Build ordered trim steps from domain sectionPriority (lowest priority first)
  const trimSteps = buildTrimSteps(pruned, domain);

  for (const step of trimSteps) {
    step();
    if (JSON.stringify(pruned).length <= MAX_AI_INPUT_CHARS) break;
  }

  return pruned;
}

/** Build ordered trim steps from domain config (lowest priority first). */
function buildTrimSteps(pruned: Record<string, unknown>, domain?: Domain): Array<() => void> {
  // Default section order (lowest priority first → dropped first)
  let priority: string[];

  if (domain && domain !== "unknown" && IndustryConfig[domain]) {
    priority = [...IndustryConfig[domain].sectionPriority].reverse();
  } else {
    priority = ["interests", "volunteer", "publications", "awards", "projects", "certifications", "education", "skills", "experience"];
  }

  const steps: Array<() => void> = [];

  for (const section of priority) {
    if (section === "experience") continue;
    steps.push(() => { (pruned as Record<string, unknown[]>)[section] = []; });
  }

  // Summary Mode — collapse experience descriptions
  steps.push(() => {
    const exp = (pruned.experience as Array<{ description?: string; achievements?: string[] }>) || [];
    for (const e of exp) {
      if (e.description) e.description = oneSentenceSummary(e.description);
      if (e.achievements && e.achievements.length > 2) e.achievements = e.achievements.slice(0, 2);
    }
  });

  // Hard truncation
  steps.push(() => {
    const exp = (pruned.experience as Array<{ description?: string }>) || [];
    for (const e of exp) {
      if (e.description && e.description.length > 120) {
        e.description = e.description.substring(0, 120).trim() + "...";
      }
    }
  });

  return steps;
}
