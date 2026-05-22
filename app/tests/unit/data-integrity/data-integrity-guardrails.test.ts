import { describe, expect, it } from "vitest";
import {
  createTraceReport,
  ensureKept,
  sanitizeJsonCv,
  smartPrune,
  validateWriterOutput,
} from "../../../api/agents/data-integrity";

describe("data integrity guardrails", () => {
  it("ensureKept restores missing keep entries", () => {
    const recovered: Record<string, number> = {};
    const keep: Array<{ index: number; name: string }> = [{ index: 0, name: "Existing" }];

    ensureKept(
      ["first", "second", "third"],
      keep,
      (idx) => ({ index: idx, name: `Recovered ${idx}` }),
      "projects",
      recovered
    );

    expect(keep).toHaveLength(3);
    expect(keep.map((k) => k.index)).toEqual([0, 1, 2]);
    expect(recovered.projects).toBe(2);
  });

  it("sanitizeJsonCv creates mandatory safe structure", () => {
    const sanitized = sanitizeJsonCv({
      name: "undefined",
      sections: "bad",
      skills: null,
      metadata: null,
    });

    expect(sanitized.name).toBe("");
    expect(sanitized.title).toBe("");
    expect(sanitized.contact).toEqual({});
    expect(sanitized.sections).toEqual([]);
    expect(sanitized.skills).toEqual({ categories: [] });
    expect(sanitized.metadata).toEqual({
      targetRole: "",
      tone: "",
      emphasis: [],
    });
  });

  it("validateWriterOutput rejects malformed writer output", () => {
    expect(() => validateWriterOutput(null)).toThrow("Writer output is not an object");
    expect(() => validateWriterOutput({ jsonCv: {} })).toThrow("Writer output missing markdown");
    expect(() => validateWriterOutput({ markdown: "x" })).toThrow("Writer output missing jsonCv");
    expect(() =>
      validateWriterOutput({ markdown: "x", jsonCv: { sections: "bad" } })
    ).toThrow("jsonCv.sections must be an array");
  });

  it("validateWriterOutput accepts minimal valid writer output", () => {
    expect(() =>
      validateWriterOutput({
        markdown: "# CV",
        jsonCv: { sections: [] },
      })
    ).not.toThrow();
  });

  it("createTraceReport initializes an observable trace", () => {
    const report = createTraceReport("rule-based");

    expect(report.pipeline).toBe("rule-based");
    expect(report.validationPassed).toBe(true);
    expect(report.recovered).toEqual({});
    expect(report.coverage).toEqual({});
  });

  it("smartPrune returns small profiles unchanged", () => {
    const profile = {
      name: "Alex Rossi",
      title: "Data Analyst",
      contact: { email: "alex@example.com", additionalLinks: [] },
      summary: "Short profile",
      experience: [],
      education: [],
      skills: { technical: ["Python"], soft: [], languages: [], tools: [] },
      certifications: [],
      projects: [],
      awards: [],
      publications: [],
      volunteer: [],
      interests: [],
    };

    const pruned = smartPrune(profile as any, "tech" as any);

    expect(pruned).toEqual(profile);
  });
});