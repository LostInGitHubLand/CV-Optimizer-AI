import { describe, expect, it } from "vitest";
import { PROMPT_INJECTION_GUARD, TRUTH_LAYER_ZERO_FABRICATION, TRUTH_LAYER_METRIC_FREEZE } from "../../../api/agents/core-rules";

describe("core security rules", () => {
  it("contains prompt-injection protections", () => {
    expect(PROMPT_INJECTION_GUARD.toLowerCase()).toContain("ignore");
    expect(PROMPT_INJECTION_GUARD.toLowerCase()).toContain("candidate data");
    expect(PROMPT_INJECTION_GUARD.toLowerCase()).toContain("plain text");
  });
  it("contains zero-fabrication protections", () => {
    expect(TRUTH_LAYER_ZERO_FABRICATION.toLowerCase()).toContain("never invent");
    expect(TRUTH_LAYER_ZERO_FABRICATION.toLowerCase()).toContain("certifications");
    expect(TRUTH_LAYER_ZERO_FABRICATION.toLowerCase()).toContain("publications");
  });
  it("contains metric-freeze protections", () => {
    expect(TRUTH_LAYER_METRIC_FREEZE.toLowerCase()).toContain("percentage");
    expect(TRUTH_LAYER_METRIC_FREEZE.toLowerCase()).toContain("dollar");
    expect(TRUTH_LAYER_METRIC_FREEZE.toLowerCase()).toContain("team size");
  });
});
