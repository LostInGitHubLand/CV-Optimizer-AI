import { describe, expect, it } from "vitest";
import { runRuleBasedAnalysis } from "../../../api/agents/analyst";
import { baseJobAdvert, baseProfile } from "../../fixtures/profiles/base-profile";
import { createMockLogger } from "../../helpers/mock-logger";

describe("Analyst rule-based fallback", () => {
  it("keeps all real core sections", () => {
    const result = runRuleBasedAnalysis(baseJobAdvert, baseProfile as any, "tech" as any, createMockLogger() as any);
    expect(result.jsonStrategy.keep.experience).toHaveLength(baseProfile.experience.length);
    expect(result.jsonStrategy.keep.education).toHaveLength(baseProfile.education.length);
    expect(result.jsonStrategy.keep.certifications).toHaveLength(baseProfile.certifications.length);
    expect(result.jsonStrategy.keep.projects).toHaveLength(baseProfile.projects.length);
    expect(result.jsonStrategy.keep.awards).toHaveLength(baseProfile.awards.length);
    expect(result.jsonStrategy.keep.volunteer).toHaveLength(baseProfile.volunteer.length);
  });
  it("does not ask to remove real experience by default", () => {
    const result = runRuleBasedAnalysis(baseJobAdvert, baseProfile as any, "tech" as any, createMockLogger() as any);
    expect(result.jsonStrategy.remove.experience).toEqual([]);
  });
  it("produces analyst review arrays for the frontend panel", () => {
    const result = runRuleBasedAnalysis(baseJobAdvert, baseProfile as any, "tech" as any, createMockLogger() as any);
    expect(Array.isArray(result.jsonStrategy.strengths)).toBe(true);
    expect(Array.isArray(result.jsonStrategy.shortcomings)).toBe(true);
    expect(Array.isArray(result.jsonStrategy.interviewTips)).toBe(true);
  });
});
