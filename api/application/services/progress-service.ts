/**
 * Application — Progress Service
 *
 * SINGLE SOURCE OF TRUTH for progress state.
 *
 * Architecture:
 *   - In-memory cache for real-time streaming (EventSource)
 *   - DB persistence for durability
 *   - All writes flow through here — no scattered updates
 *
 * Eliminates the previous problem where:
 *   - router updated DB + memory
 *   - pipeline updated memory separately
 *   - progress state was inconsistent
 */

import { updateJobStatus, findJobById } from "../../repositories/cv-job-repository";
import { JobStatus } from "../../domain/workflow/job-status";
import type { Logger } from "../../infrastructure/logging/logger";

/** In-memory progress cache — keyed by jobId */
const progressCache = new Map<number, {
  status: JobStatus;
  currentAgent: string;
  agentMessage: string;
  strategyData?: string;
  designState?: string;
}>();

/* ── Write ──────────────────────────────────────────────────────────────── */

export async function publishProgress(
  jobId: number,
  status: JobStatus,
  currentAgent: string,
  agentMessage: string,
  opts?: {
    strategyData?: string | Record<string, unknown>;
    designState?: string;
    persist?: boolean; // default true
  },
  log?: Logger
): Promise<void> {
  const { strategyData: rawStrategy, designState, persist = true } = opts ?? {};

  // Normalize strategyData: accept string or object, store as string in cache
  let strategyData: string | undefined;
  if (rawStrategy) {
    strategyData = typeof rawStrategy === "string" ? rawStrategy : JSON.stringify(rawStrategy);
  }

  // 1. Update in-memory cache (always — for EventSource streaming)
  // Preserve existing strategyData if not explicitly provided in this update
  const existing = progressCache.get(jobId);
  progressCache.set(jobId, {
    status,
    currentAgent,
    agentMessage,
    strategyData: strategyData ?? existing?.strategyData,
    designState,
  });

  // 2. Persist to DB (default true, can be skipped for high-frequency updates)
  if (persist) {
    await updateJobStatus(jobId, status, currentAgent, agentMessage);
  }
}

/** Shorthand: mark an agent as working */
export async function agentStarted(
  jobId: number,
  status: JobStatus,
  agent: string,
  message: string,
  log?: Logger
): Promise<void> {
  await publishProgress(jobId, status, agent, message, undefined, log);
}

/** Shorthand: mark pipeline as complete, awaiting review */
export async function pipelineComplete(
  jobId: number,
  designStateStr?: string,
  log?: Logger
): Promise<void> {
  await publishProgress(
    jobId,
    JobStatus.AwaitingReview,
    "",
    "Initial generation complete. Review and refine your CV.",
    { designState: designStateStr },
    log
  );
}

/** Shorthand: mark refinement as complete */
export async function refinementComplete(
  jobId: number,
  designStateStr?: string,
  log?: Logger
): Promise<void> {
  await publishProgress(
    jobId,
    JobStatus.AwaitingReview,
    "",
    "Refinement complete. Review the updated CV.",
    { designState: designStateStr },
    log
  );
  // Note: pipeline report is printed ONLY when user clicks "I'm so satisfied"
}

/** Shorthand: mark error */
export async function markError(
  jobId: number,
  message: string,
  log?: Logger
): Promise<void> {
  await publishProgress(jobId, JobStatus.Error, "", message, undefined, log);
}

/** Shorthand: mark as completed (satisfied) */
export async function markCompleted(
  jobId: number,
  log?: Logger
): Promise<void> {
  await publishProgress(jobId, JobStatus.Completed, "", "Pipeline complete", undefined, log);
}

/* ── Read ───────────────────────────────────────────────────────────────── */

export function getCachedProgress(jobId: number) {
  return progressCache.get(jobId) ?? null;
}

export async function getProgressWithFallback(
  jobId: number
): Promise<{
  status: JobStatus;
  currentAgent: string | null;
  agentMessage: string | null;
  strategyData?: Record<string, unknown>;
  designState?: Record<string, unknown>;
}> {
  // 1. Check in-memory cache first (freshest)
  const cached = progressCache.get(jobId);
  if (cached) {
    return {
      status: cached.status,
      currentAgent: cached.currentAgent,
      agentMessage: cached.agentMessage,
      strategyData: safeParse(cached.strategyData),
      designState: safeParse(cached.designState),
    };
  }

  // 2. Fallback to DB
  const job = await findJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  return {
    status: job.status,
    currentAgent: job.currentAgent,
    agentMessage: job.agentMessage,
    strategyData: job.jsonStrategy,
    designState: job.designState ? JSON.parse(JSON.stringify(job.designState)) : undefined,
  };
}

/* ── Cleanup ────────────────────────────────────────────────────────────── */

export function clearProgress(jobId: number): void {
  progressCache.delete(jobId);
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function safeParse(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
}
