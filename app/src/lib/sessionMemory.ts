/**
 * Session-only memory store.
 * Persists across React route changes (e.g., Home -> HowItWorks -> Home)
 * but is cleared on page reload or tab close.
 *
 * Usage: call setActiveJob(jobId) when starting a pipeline,
 * call getActiveJob() on Home mount to reattach to running jobs,
 * call clearActiveJob() when satisfied or on error.
 */

let _activeJobId: number | null = null;
let _hasEnteredPipeline = false;

export function setActiveJob(jobId: number) {
  _activeJobId = jobId;
  _hasEnteredPipeline = true;
}

export function getActiveJob(): number | null {
  return _activeJobId;
}

export function clearActiveJob() {
  _activeJobId = null;
  _hasEnteredPipeline = false;
}

export function hasActiveJob(): boolean {
  return _activeJobId !== null;
}

export function hasEnteredPipeline(): boolean {
  return _hasEnteredPipeline;
}
