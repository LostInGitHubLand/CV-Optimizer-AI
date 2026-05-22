import { describe, expect, it, vi } from "vitest";
import { JobStatus } from "../../../api/domain/workflow/job-status";

vi.mock("../../../api/repositories/cv-job-repository", () => ({
  updateJobStatus: vi.fn(async () => undefined),
  findJobById: vi.fn(async () => null),
}));

describe("Progress service", () => {
  it("publishes and reads WRITER_REFINE and DESIGNER_REFINE progress", async () => {
    const mod = await import("../../../api/application/services/progress-service");
    await mod.publishProgress(101, JobStatus.Refining, "WRITER_REFINE", "Applying writer refinements...");
    expect(mod.getCachedProgress(101)?.currentAgent).toBe("WRITER_REFINE");
    await mod.publishProgress(101, JobStatus.Refining, "DESIGNER_REFINE", "Applying design refinements...");
    expect(mod.getCachedProgress(101)?.currentAgent).toBe("DESIGNER_REFINE");
  });
  it("preserves strategyData across later progress events", async () => {
    const mod = await import("../../../api/application/services/progress-service");
    await mod.publishProgress(102, JobStatus.Analyzing, "ANALYST", "Strategy complete", { strategyData: { strengths: ["Python"], shortcomings: [], interviewTips: ["Prepare project walkthrough"] } });
    await mod.publishProgress(102, JobStatus.Writing, "WRITER", "Writing CV...");
    const progress = await mod.getProgressWithFallback(102);
    expect(progress.strategyData?.strengths).toEqual(["Python"]);
  });
});
