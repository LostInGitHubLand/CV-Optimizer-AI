import { describe, expect, it } from "vitest";
import { renderSkillsSection } from "../../../../api/design-system/sections/skills";

describe("skills section variants", () => {
  const cv = {
    skills: {
      categories: [
        { name: "Data & AI", items: ["Python", "SQL", "Machine Learning"] },
        { name: "Frontend", items: ["React", "TypeScript"] },
      ],
    },
  };

  it("renders visual matrix", () => {
    const html = renderSkillsSection(cv as any, "visual-matrix");

    expect(html).toContain("Python");
    expect(html).toContain("React");
    expect(html).toContain("cv-skills");
  });

  it("renders floating cards by group", () => {
    const html = renderSkillsSection(cv as any, "floating-cards");

    expect(html).toContain("Data &amp; AI");
    expect(html).toContain("Frontend");
    expect(html).toContain("Python");
  });

  it("renders accent pills grouped", () => {
    const html = renderSkillsSection(cv as any, "accent-pills" as any);

    expect(html).toContain("Python");
    expect(html).toContain("TypeScript");
  });

  it("renders accent pills flat", () => {
    const html = renderSkillsSection(cv as any, "accent-pills-flat" as any);

    expect(html).toContain("Python");
    expect(html).toContain("React");
  });

  it("renders expertise bars with explicit levels", () => {
    const html = renderSkillsSection(cv as any, "expertise-bars", {
      Python: 90,
      SQL: 80,
      "Machine Learning": 70,
      React: 85,
      TypeScript: 75,
    });

    expect(html).toContain("Python");
    expect(html).toContain("width:90%");
    expect(html).toContain("React");
  });

  it("falls back safely for empty skills", () => {
    const html = renderSkillsSection({ skills: { categories: [] } } as any, "compact-tags");

    expect(html === null || html === "").toBe(true);
  });
});