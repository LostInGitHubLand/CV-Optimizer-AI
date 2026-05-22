import { describe, expect, it } from "vitest";
import {
  createTraceReport,
  ensureKept,
  sanitizeJsonCv,
  validateWriterOutput,
} from "../../../api/agents/data-integrity";

describe("data-integrity utilities", () => {
  it("ensureKept restores missing source indexes and records recovery counts", () => {
    const source = [{ role: "Analyst" }, { role: "Coach" }, { role: "Researcher" }];
    const keep = [{ index: 0, role: "Analyst" }];
    const recovered: Record<string, number> = {};

    ensureKept(
      source,
      keep,
      (idx) => ({ index: idx, role: `Recovered ${idx}`, reason: "Preserved by fallback" }),
      "experience",
      recovered
    );

    expect(keep.map((item) => item.index)).toEqual([0, 1, 2]);
    expect(recovered).toEqual({ experience: 2 });
  });

  it("createTraceReport returns an observable default trace object", () => {
    expect(createTraceReport("rule-based")).toEqual({
      pipeline: "rule-based",
      rawResponse: null,
      validationPassed: true,
      validationErrors: null,
      recovered: {},
      coverage: {},
    });
  });

  it("sanitizeJsonCv fills required fields and strips literal undefined strings", () => {
    const sanitized = sanitizeJsonCv({ name: "undefined", sections: "bad", skills: null });

    expect(sanitized.name).toBe("");
    expect(sanitized.title).toBe("");
    expect(sanitized.contact).toEqual({});
    expect(sanitized.summary).toBe("");
    expect(sanitized.sections).toEqual([]);
    expect(sanitized.skills).toEqual({ categories: [] });
    expect(sanitized.metadata).toEqual({ targetRole: "", tone: "", emphasis: [] });
  });

  it("validateWriterOutput accepts valid writer output and rejects malformed data", () => {
    expect(() =>
      validateWriterOutput({ markdown: "# CV", jsonCv: { sections: [] } })
    ).not.toThrow();

    expect(() => validateWriterOutput(null)).toThrow(/not an object/i);
    expect(() => validateWriterOutput({ jsonCv: { sections: [] } })).toThrow(/markdown/i);
    expect(() => validateWriterOutput({ markdown: "# CV" })).toThrow(/jsonCv/i);
    expect(() => validateWriterOutput({ markdown: "# CV", jsonCv: { sections: {} } })).toThrow(/sections/i);
  });
});
