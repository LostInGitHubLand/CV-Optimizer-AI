/**
 * Application — Pipeline Execution Service
 *
 * Orchestrates the full 4-stage pipeline:
 *   Fetcher → Analyst → Writer → Designer
 *
 * Responsibilities:
 *   - Job lookup + validation
 *   - Status transitions (via state machine)
 *   - Progress publishing (via progress service)
 *   - Domain detection
 *   - Delegates actual agent execution to api/pipeline/core.ts
 *
 * Does NOT touch the database directly — uses JobService + ProgressService.
 */

import { runPipelineWithResilience } from "../../pipeline/core";
import { getJob, assertJobExists, detectAndSetDomain } from "./job-service";
import { publishProgress, agentStarted, markError } from "./progress-service";
import { JobStatus } from "../../domain/workflow/job-status";
import { logger } from "../../infrastructure/logging/logger";
import { unloadAllModels } from "../../infrastructure/ai/ollama";

export async function executePipeline(
  jobId: number,
  jobAdvert: string,
  logParent: ReturnType<typeof logger>
): Promise<void> {
  const log = logParent.child({ sessionId: `p_${Date.now()}` });

  try {
    // 1. Validate job exists
    const job = await assertJobExists(jobId);
    log.info("PIPELINE_SERVICE", `Job ${jobId} validated, starting pipeline`);

    // 2. Persist job advert + detect domain
    //    IMPORTANT: use the returned domain, NOT job.domain (stale)
    const domain = await detectAndSetDomain(jobId, job.rawText, jobAdvert, log);

    // 3. Transition to running + publish progress
    await publishProgress(jobId, JobStatus.Fetching, "", "Pipeline starting...", undefined, log);

    // 4. Run pipeline (async — returns immediately)
    //    Use the freshly detected domain, not the stale job.domain
    runPipelineWithResilience(jobId, domain, log)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("PIPELINE_SERVICE", `Pipeline failed: ${msg}`);
        markError(jobId, msg, log).catch(() => {});
      });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("PIPELINE_SERVICE", `Setup failed: ${msg}`);
    await markError(jobId, msg, log);
    throw err;
  }
}

/** Synchronous health check — does NOT use service layer */
export { isOllamaAvailable } from "../../infrastructure/ai/ollama";
