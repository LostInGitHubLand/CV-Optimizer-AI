/**
 * Pipeline Progress — thin re-export of ProgressService
 *
 * Kept for backward compatibility with modules that import from here.
 * New code should import directly from application/services/progress-service.
 */

export {
  getCachedProgress as getProgress,
  publishProgress as setProgress,
} from "../application/services/progress-service";
