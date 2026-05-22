import { describe, it, expect } from "vitest";
import { renderSkillsSection } from "../../../../api/design-system/sections/skills";

describe("skills section", () => {
  const mockCv = {
    skills: {
      categories: [
        { name: "Technical", items: ["Python", "SQL", "React"] },
        { name: "Soft", items: ["Leadership"] },
      ],
    },
  };

  it("renders compact tags", () => {
    const html = renderSkillsSection(mockCv as any, "compact-tags");

    expect(html).toContain("Python");
    expect(html).toContain("SQL");
  });

  it("renders expertise bars", () => {
    const html = renderSkillsSection(mockCv as any, "expertise-bars", {
      Python: 90,
      SQL: 80,
      React: 70,
      Leadership: 100,
    });

    expect(html).toContain("Python");
    expect(html).toContain("SQL");
  });
});