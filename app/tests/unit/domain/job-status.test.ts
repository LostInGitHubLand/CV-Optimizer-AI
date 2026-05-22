import { describe, expect, it } from "vitest";
import {
  canTransition,
  JobStatus,
  parseJobStatus,
  TransitionError,
  validateTransition,
} from "../../../api/domain/workflow/job-status";

describe("workflow job status state machine", () => {
  it("allows the main pipeline and refinement transitions", () => {
    expect(validateTransition(JobStatus.Pending, JobStatus.Fetching)).toBe(JobStatus.Fetching);
    expect(validateTransition(JobStatus.Fetching, JobStatus.Analyzing)).toBe(JobStatus.Analyzing);
    expect(validateTransition(JobStatus.Analyzing, JobStatus.Writing)).toBe(JobStatus.Writing);
    expect(validateTransition(JobStatus.Writing, JobStatus.Designing)).toBe(JobStatus.Designing);
    expect(validateTransition(JobStatus.Designing, JobStatus.AwaitingReview)).toBe(JobStatus.AwaitingReview);
    expect(validateTransition(JobStatus.AwaitingReview, JobStatus.Refining)).toBe(JobStatus.Refining);
    expect(validateTransition(JobStatus.Refining, JobStatus.AwaitingReview)).toBe(JobStatus.AwaitingReview);
  });

  it("rejects invalid transitions and exposes safe canTransition checks", () => {
    expect(canTransition(JobStatus.Completed, JobStatus.Refining)).toBe(false);
    expect(canTransition(JobStatus.AwaitingReview, JobStatus.Completed)).toBe(true);
    expect(() => validateTransition(JobStatus.Completed, JobStatus.Writing)).toThrow(TransitionError);
  });

  it("parses normalized status strings and rejects unknown statuses", () => {
    expect(parseJobStatus(" awaiting_review ")).toBe(JobStatus.AwaitingReview);
    expect(parseJobStatus("REFINING")).toBe(JobStatus.Refining);
    expect(() => parseJobStatus("writer_refine")).toThrow(TransitionError);
  });
});
