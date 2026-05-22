import { describe, expect, it } from "vitest";
import { renderSemanticHtml } from "../../../api/design-system/renderer";
import { createDefaultComposition } from "../../../api/design-system/composition";
import { resolveDesignState } from "../../../api/design-system/semantic/resolution";
import { createMockLogger } from "../../helpers/mock-logger";

describe("semantic renderer smoke tests", () => {
  it("renders semantic HTML with section variants and data overrides", () => {
    const cv = {
      name: "Alex Rossi",
      title: "Data Scientist",
      contact: { email: "alex@example.com" },
      summary: "Data scientist focused on reliable ML systems.",
      sections: [
        { type: "experience", title: "Experience", entries: [{ heading: "Data Scientist", subheading: "ACME", date: "2024", bullets: ["Built ML pipelines"] }] },
        { type: "education", title: "Education", entries: [{ heading: "MSc Data Science", subheading: "University", date: "2022", bullets: [] }] },
        { type: "languages", title: "Languages", entries: [{ heading: "English", subheading: "Professional", bullets: [] }] },
      ],
      languages: [{ language: "English", level: "Professional" }],
      skills: { categories: [{ name: "Data", items: ["Python", "SQL"] }] },
      metadata: { targetRole: "Data Scientist", tone: "modern", emphasis: [] },
    };

    const composition = createDefaultComposition("single-column", "minimal-swiss");
    composition.sectionVariants = { skills: "expertise-bars", languages: "proficiency-bars" } as any;
    composition.sectionDataOverrides = {
      skills: { levels: { _default: 100, Python: 70 } },
      languages: { proficiencies: { English: "Professional" } },
    };
    const state = resolveDesignState(composition, createMockLogger() as any);
    const html = renderSemanticHtml(cv as any, composition, state);

    expect(html).toContain("Alex Rossi");
    expect(html).toContain("cv-layout--single-column");
    expect(html).toContain("cv-expertise-bar");
    expect(html).toContain("Python");
    expect(html).not.toContain("asymmetric-grid");
  });
});
