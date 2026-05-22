import { describe, expect, it } from "vitest";
import {
  ensureKept,
  sanitizeJsonCv,
  smartPrune,
  validateWriterOutput,
} from "../../../api/agents/data-integrity";

describe("data integrity deep behavior", () => {
  it("ensureKept does nothing for empty source arrays", () => {
    const recovered: Record<string, number> = {};
    const keep: Array<{ index: number; name: string }> = [];

    ensureKept([], keep, (idx) => ({ index: idx, name: `Recovered ${idx}` }), "awards", recovered);

    expect(keep).toEqual([]);
    expect(recovered).toEqual({});
  });

  it("ensureKept does not duplicate already kept indexes", () => {
    const recovered: Record<string, number> = {};
    const keep = [
      { index: 0, name: "Existing 0" },
      { index: 1, name: "Existing 1" },
    ];

    ensureKept(["a", "b"], keep, (idx) => ({ index: idx, name: `Recovered ${idx}` }), "projects", recovered);

    expect(keep).toHaveLength(2);
    expect(recovered).toEqual({});
  });

  it("sanitizeJsonCv keeps valid structure while normalizing missing mandatory fields", () => {
    const sanitized = sanitizeJsonCv({
      name: "Alex Rossi",
      title: "Data Analyst",
      contact: { email: "alex@example.com" },
      summary: "undefined",
      sections: [{ type: "experience", entries: [] }],
      skills: { categories: [{ name: "Data", items: ["Python"] }] },
      metadata: { targetRole: "Data Analyst", tone: "modern", emphasis: ["Python"] },
    });

    expect(sanitized.name).toBe("Alex Rossi");
    expect(sanitized.title).toBe("Data Analyst");
    expect(sanitized.contact).toEqual({ email: "alex@example.com" });
    expect(Array.isArray(sanitized.sections)).toBe(true);
    expect(sanitized.skills).toEqual({ categories: [{ name: "Data", items: ["Python"] }] });
  });

  it("validateWriterOutput accepts valid output and rejects invalid sections", () => {
    expect(() =>
      validateWriterOutput({
        markdown: "# Alex",
        jsonCv: {
          sections: [],
        },
      })
    ).not.toThrow();

    expect(() =>
      validateWriterOutput({
        markdown: "# Alex",
        jsonCv: {
          sections: {},
        },
      })
    ).toThrow("jsonCv.sections must be an array");
  });

  it("smartPrune shortens large profiles while preserving core identity", () => {
    const profile = {
      name: "Alex Rossi",
      title: "Data Analyst",
      contact: { email: "alex@example.com", additionalLinks: [] },
      summary: "x".repeat(5000),
      experience: Array.from({ length: 40 }).map((_, index) => ({
        role: `Role ${index}`,
        company: `Company ${index}`,
        location: "Rome",
        startDate: "2020",
        endDate: "2021",
        description: `Sentence one for role ${index}. ${"Extra details ".repeat(80)}`,
        achievements: [`Achievement ${index}`],
      })),
      education: [],
      skills: {
        technical: ["Python", "SQL"],
        soft: ["Communication"],
        languages: ["Italian"],
        tools: ["Excel"],
      },
      certifications: [],
      projects: [],
      awards: [],
      publications: [],
      volunteer: [],
      interests: [],
    };

    const before = JSON.stringify(profile).length;
    const pruned = smartPrune(profile as any, "tech" as any);
    const after = JSON.stringify(pruned).length;

    expect(pruned.name).toBe("Alex Rossi");
    expect(pruned.title).toBe("Data Analyst");
    expect(after).toBeLessThan(before);
  });
});