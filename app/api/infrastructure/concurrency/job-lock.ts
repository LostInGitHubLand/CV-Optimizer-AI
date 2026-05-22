/**
 * Infrastructure — Job Locking & Progress Map Management
 *
 * Production concerns:
 *   - Prevents concurrent pipeline execution for the same job (GPU protection)
 *   - Cleans up progressMap entries to prevent memory leaks
 *   - Maps job status strings to "in-progress" classification
 */

import { logger } from "../logging/logger";
import { JobStatus } from "../../domain/workflow/job-status";

const log = logger();

/** Statuses that indicate a job is actively being processed. */
const IN_PROGRESS_STATUSES = new Set([
  JobStatus.Fetching,
  JobStatus.Analyzing,
  JobStatus.Writing,
  JobStatus.Designing,
  JobStatus.Refining,
]);

/** Terminal statuses after which progressMap entries can be safely deleted. */
const TERMINAL_STATUSES = new Set([
  JobStatus.Completed,
  JobStatus.Error,
]);

/** Returns true if the given status string indicates active processing. */
export function isInProgress(status: string): boolean {
  return IN_PROGRESS_STATUSES.has(status);
}

/** Returns true if the given status string indicates a terminal state. */
export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Check if a job is already running by querying its DB status.
 * Throws an error with a clear message if the job is locked.
 */
export async function assertJobNotLocked(
  jobId: number,
  getStatus: () => Promise<{ status: string; currentAgent: string | null } | undefined>
): Promise<void> {
  const row = await getStatus();
  if (row && isInProgress(row.status)) {
    throw new Error(
      `Job ${jobId} already in progress (status: ${row.status}, agent: ${row.currentAgent ?? "unknown"}). ` +
      `Wait for completion or check status via cv.getJobProgress.`
    );
  }
}

/**
 * Clean up a progressMap entry after a job reaches a terminal state.
 * Call this in the finally block of runPipeline.
 */
export function cleanupProgressMap<K, V>(map: Map<K, V>, key: K, jobId: number): void {
  if (map.has(key)) {
    map.delete(key);
    log.info("LOCK", `ProgressMap entry cleaned for job ${jobId} (status terminal)`);
  }
}

/**
 * Utility: wrap an async operation with a timeout.
 * If the operation exceeds `timeoutMs`, it rejects with a clear error.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(
        `Pipeline timeout: ${operationName} exceeded ${timeoutMs}ms. ` +
        `Possible causes: model still loading into VRAM, network issue, or GPU resource exhaustion.`
      ));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
