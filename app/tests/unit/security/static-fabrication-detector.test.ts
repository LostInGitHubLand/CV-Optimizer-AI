import { describe, expect, it } from "vitest";
import { collectFabricationIssues } from "../../helpers/fabrication-detector";

describe("static fabrication detector", () => {
  it("flags invented percentages", () => {
    const issues = collectFabricationIssues("Built weekly dashboards.", "Built weekly dashboards increasing reporting accuracy by 92%.");
    expect(issues.some((i) => i.category === "invented_metric")).toBe(true);
  });
  it("flags finalist rewritten as winner", () => {
    const issues = collectFabricationIssues("Finalist — Regional Data Challenge 2021", "Winner — Regional Data Challenge 2021");
    expect(issues.some((i) => i.category === "winner_distortion")).toBe(true);
  });
  it("flags coach rewritten as award recipient", () => {
    const issues = collectFabricationIssues("Basketball Coach at Local Sports Club", "Award recipient for basketball excellence");
    expect(issues.some((i) => i.category === "coach_distortion")).toBe(true);
  });
});
