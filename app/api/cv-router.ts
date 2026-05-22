/**
 * CV Router — Pure Transport Layer
 *
 * Responsibilities:
 *   - tRPC endpoint definitions
 *   - Input validation (Zod schemas)
 *   - Delegation to application services
 *   - Response shaping
 *
 * ABSOLUTELY NO:
 *   - Database access
 *   - Business logic
 *   - Serialization/deserialization
 *   - Status transition logic
 *   - Progress state management
 *
 * Architecture:
 *   cv-router.ts (transport)
 *     → application/services/* (business logic)
 *       → repositories/* (persistence)
 *         → infrastructure/db/* (database)
 */

import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { logger } from "./infrastructure/logging/logger";
import { unloadAllModels } from "./infrastructure/ai/ollama";
import { JobStatus } from "./domain/workflow/job-status";
import { printPipelineReport } from "./pipeline/metrics";
import { getLatestVersion } from "./pipeline/versioning";

// ── Application services ──
import {
  createJob,
  createTestJob,
  getJob,
  assertJobExists,
  modifyJob,
  uploadJobPdf,
  submitUpdates,
  setJobAdvert,
  restoreJobBackup,
} from "./application/services/job-service";
import {
  executePipeline,
  isOllamaAvailable,
} from "./application/services/pipeline-service";
import {
  executeRefinement,
} from "./application/services/refine-service";
import {
  getProgressWithFallback,
  markCompleted,
  clearProgress,
} from "./application/services/progress-service";
import { safeJsonParse } from "./application/serializers/cv-job-serializer";

/* ── Re-export for api/boot.ts (progress streaming) ── */
export { getCachedProgress as getProgress } from "./application/services/progress-service";

/* ── ZOD INPUT SCHEMAS ──────────────────────────────────────────────────── */

const createJobInput = z.object({
  inputType: z.string(),
  sourceUrl: z.string().optional(),
  jobAdvert: z.string().optional(),
  updates: z.string().optional(),
});
const uploadInput = z.object({ jobId: z.number(), pdfBase64: z.string() });
const processJobInput = z.object({ jobId: z.number(), jobAdvert: z.string() });
const submitUpdatesInput = z.object({ jobId: z.number(), updates: z.string() });
const refineInput = z.object({
  jobId: z.number(),
  writerInstruction: z.string().default(""),
  designerInstruction: z.string().default(""),
  editedMarkdown: z.string().optional(),
});
const jobIdInput = z.object({ jobId: z.number() });

/* ═══════════════════════════════════════════════════════════════════════════
   CV ROUTER — 16 endpoints, pure transport
   ═══════════════════════════════════════════════════════════════════════════ */

export const cvRouter = createRouter({

  /* ── 1. HEALTH CHECK ── */
  checkOllama: publicQuery.query(async () => {
    const available = await isOllamaAvailable();
    return {
      available,
      message: available
        ? "Ollama is running and reachable."
        : "Ollama is not reachable. Ensure the Ollama server is running (http://localhost:11434).",
    };
  }),

  /* ── 2. CREATE JOB ── */
  createJob: publicQuery.input(createJobInput).mutation(async ({ input }) => {
    const log = logger();
    const { id, sessionId } = await createJob(
      { inputType: input.inputType as "pdf" | "url", sourceUrl: input.sourceUrl, jobAdvert: input.jobAdvert, updates: input.updates },
      log
    );
    return { id, sessionId };
  }),

  /* ── 3. UPLOAD PDF ── */
  uploadPdf: publicQuery.input(uploadInput).mutation(async ({ input }) => {
    const log = logger({ jobId: input.jobId });
    const { filePath } = await uploadJobPdf(input.jobId, input.pdfBase64, log);
    return { filePath };
  }),

  /* ── 4. PROCESS JOB ── */
  processJob: publicQuery.input(processJobInput).mutation(async ({ input }) => {
    const log = logger({ jobId: input.jobId });
    await setJobAdvert(input.jobId, input.jobAdvert, log);
    await executePipeline(input.jobId, input.jobAdvert, log);
    return { started: true };
  }),

  /* ── 5. SUBMIT UPDATES ── */
  submitUpdates: publicQuery.input(submitUpdatesInput).mutation(async ({ input }) => {
    const log = logger({ jobId: input.jobId });
    await submitUpdates(input.jobId, input.updates, log);
    return { success: true };
  }),

  /* ── 6. REFINE ── */
  refine: publicQuery.input(refineInput).mutation(async ({ input }) => {
    const log = logger({ jobId: input.jobId });
    const job = await assertJobExists(input.jobId);

    // Pass the raw designComposition string — the service deserializes it
    await executeRefinement(
      input.jobId,
      input.writerInstruction,
      input.designerInstruction,
      input.editedMarkdown,
      job.jobAdvert ?? "",
      job.designComposition,
      log
    );

    return { started: true };
  }),

  /* ── 7. SATISFIED ── */
  satisfied: publicQuery.input(jobIdInput).mutation(async ({ input }) => {
    const log = logger({ jobId: input.jobId });
    await markCompleted(input.jobId, log);
    printPipelineReport(input.jobId, log);
    await unloadAllModels();
    log.info("ROUTER", "Job marked complete. VRAM unloaded.");
    return { success: true };
  }),

  /* ── 8. GET JOB ── */
  getJob: publicQuery.input(jobIdInput).query(async ({ input }) => {
    const job = await getJob(input.jobId);
    if (!job) throw new Error(`Job ${input.jobId} not found`);
    return job;
  }),

  /* ── 9. GET PROGRESS ── */
  getJobProgress: publicQuery.input(jobIdInput).query(async ({ input }) => {
    return getProgressWithFallback(input.jobId);
  }),

  /* ── 10. GET STRATEGY ── */
  getJobStrategy: publicQuery.input(jobIdInput).query(async ({ input }) => {
    const job = await getJob(input.jobId);
    if (!job || !job.analystOutput) return null;
    return safeJsonParse(job.analystOutput);
  }),

  /* ── 11. GET LATEST VERSION ── */
  getLatestVersion: publicQuery.input(jobIdInput).query(async ({ input }) => {
    return getLatestVersion(input.jobId);
  }),

  /* ── 12. GET MARKDOWN ── */
  getMarkdown: publicQuery.input(jobIdInput).query(async ({ input }) => {
    const job = await getJob(input.jobId);
    if (!job) throw new Error(`Job ${input.jobId} not found`);
    return { markdown: job.markdownOutput ?? "" };
  }),

  /* ── 13. GET HTML ── */
  getHtml: publicQuery.input(jobIdInput).query(async ({ input }) => {
    const job = await getJob(input.jobId);
    if (!job) throw new Error(`Job ${input.jobId} not found`);
    const raw = job.htmlOutput ?? "";
    if (raw.length > 100 && /^[A-Za-z0-9+/=]{100,}$/.test(raw.slice(0, 100))) {
      try {
        const decoded = Buffer.from(raw, "base64").toString("utf-8");
        if (decoded.startsWith("<!DOCTYPE") || decoded.startsWith("<")) {
          return { html: decoded };
        }
      } catch { /* not valid base64 */ }
    }
    return { html: raw };
  }),

  /* ── 14. DOWNLOAD PDF ── */
  downloadPdf: publicQuery.input(jobIdInput).query(async ({ input }) => {
    const job = await getJob(input.jobId);
    if (!job || !job.pdfPathOutput) throw new Error("No PDF available");
    const fs = await import("fs/promises");
    const pdfBuffer = await fs.readFile(job.pdfPathOutput);
    return { base64: pdfBuffer.toString("base64") };
  }),

  /* ── 15. TEST PIPELINE ── */
  testPipeline: publicQuery.mutation(async () => {
    const log = logger();
    const jobId = await createTestJob(log);
    return { jobId };
  }),

  /* ── 16. RESTORE BACKUP ── */
  restoreBackup: publicQuery.input(jobIdInput).mutation(async ({ input }) => {
    const log = logger({ jobId: input.jobId });
    const result = await restoreJobBackup(input.jobId, log);
    return result;
  }),
});
