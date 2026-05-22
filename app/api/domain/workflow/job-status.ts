/**
 * Domain — Workflow Job Status
 *
 * Centralized, typed state definitions for the CV pipeline.
 * The database stores these as strings for persistence, but
 * all application code uses the JobStatus enum for type safety.
 */

export enum JobStatus {
  Pending = "pending",
  Uploaded = "uploaded",
  Fetching = "fetching",
  Analyzing = "analyzing",
  Writing = "writing",
  Designing = "designing",
  AwaitingReview = "awaiting_review",
  Refining = "refining",
  Completed = "completed",
  Error = "error",
}

export enum PipelineState {
  Main = "main",
  Refine = "refine",
}

/* ── Valid state transitions ──
   Each entry: fromStatus → Set<toStatus>
   Any transition not in this map is rejected at runtime.         */

const VALID_TRANSITIONS: Record<JobStatus, Set<JobStatus>> = {
  [JobStatus.Pending]: new Set([
    JobStatus.Uploaded,
    JobStatus.Fetching,
    JobStatus.Error,
  ]),
  [JobStatus.Uploaded]: new Set([
    JobStatus.Fetching,
    JobStatus.Error,
  ]),
  [JobStatus.Fetching]: new Set([
    JobStatus.Analyzing,
    JobStatus.Error,
    JobStatus.AwaitingReview,
  ]),
  [JobStatus.Analyzing]: new Set([
    JobStatus.Writing,
    JobStatus.Error,
    JobStatus.AwaitingReview,
  ]),
  [JobStatus.Writing]: new Set([
    JobStatus.Designing,
    JobStatus.Error,
    JobStatus.AwaitingReview,
  ]),
  [JobStatus.Designing]: new Set([
    JobStatus.AwaitingReview,
    JobStatus.Error,
  ]),
  [JobStatus.AwaitingReview]: new Set([
    JobStatus.Refining,
    JobStatus.Completed,
    JobStatus.Error,
  ]),
  [JobStatus.Refining]: new Set([
    JobStatus.AwaitingReview,
    JobStatus.Completed,
    JobStatus.Error,
  ]),
  [JobStatus.Completed]: new Set([]),
  [JobStatus.Error]: new Set([
    JobStatus.Pending,
    JobStatus.Fetching,
  ]),
};

/**
 * Validate a status transition. Returns the target status if valid,
 * or throws a descriptive error if the transition is disallowed.
 */
export function validateTransition(
  from: JobStatus,
  to: JobStatus
): JobStatus {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) {
    throw new TransitionError(
      `Unknown source status "${from}". No transition rules defined.`
    );
  }
  if (!allowed.has(to)) {
    throw new TransitionError(
      `Invalid transition: "${from}" → "${to}" is not allowed.`
    );
  }
  return to;
}

/**
 * Check if a transition is valid without throwing.
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  try {
    validateTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

/**
 * Coerce a raw string (from DB or external input) into a JobStatus.
 * Throws if the string is not a recognized status.
 */
export function parseJobStatus(raw: string): JobStatus {
  const normalized = raw.trim().toLowerCase();
  const match = Object.values(JobStatus).find((s) => s === normalized);
  if (!match) {
    throw new TransitionError(
      `"${raw}" is not a valid JobStatus. Expected one of: ${Object.values(JobStatus).join(", ")}`
    );
  }
  return match as JobStatus;
}

export class TransitionError extends Error {
  readonly code = "INVALID_STATUS_TRANSITION";
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}
