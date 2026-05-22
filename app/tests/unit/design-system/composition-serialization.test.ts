import { describe, expect, it } from "vitest";
import {
  createDefaultComposition,
  deserializeDesignComposition,
  inferInitialComposition,
  serializeDesignComposition,
} from "../../../api/design-system/composition";
import { createMockLogger } from "../../helpers/mock-logger";

describe("DesignComposition serialization and defaults", () => {
  it("creates sidebar compositions with section layout and empty overrides", () => {
    const composition = createDefaultComposition("sidebar-left", "minimal-swiss");

    expect(composition.layoutId).toBe("sidebar-left");
    expect(composition.themeId).toBe("minimal-swiss");
    expect(composition.sectionLayout.main.length).toBeGreaterThan(0);
    expect(composition.sectionLayout.sidebar?.length).toBeGreaterThan(0);
    expect(composition.sectionVariants).toEqual({});
    expect(composition.sectionDataOverrides).toEqual({});
    expect(composition.renderingOverrides).toEqual([]);
  });

  it("round-trips composition and preserves sectionDataOverrides", () => {
    const composition = createDefaultComposition("sidebar-right", "clean-startup");

    composition.semanticState = {
      ...composition.semanticState,
      tone: "modern",
      density: "spacious",
    };

    composition.sectionVariants = {
      skills: "expertise-bars",
      languages: "proficiency-bars",
    } as typeof composition.sectionVariants;

    composition.sectionDataOverrides = {
      skills: { levels: { _default: 100, Python: 70 } },
      languages: {
        levels: { English: 80 },
        proficiencies: { English: "Professional" },
      },
    };

    const serialized = serializeDesignComposition(composition);
    const restored = deserializeDesignComposition(serialized);

    expect(restored?.layoutId).toBe("sidebar-right");
    expect(restored?.themeId).toBe("clean-startup");
    expect(restored?.sectionVariants.skills).toBe("expertise-bars");
    expect(restored?.sectionDataOverrides.skills?.levels?.Python).toBe(70);
    expect(restored?.sectionDataOverrides.languages?.proficiencies?.English).toBe("Professional");
  });

  it("returns null for missing or invalid serialized composition", () => {
    expect(deserializeDesignComposition(null)).toBeNull();
    expect(deserializeDesignComposition(undefined)).toBeNull();
    expect(deserializeDesignComposition("not-json")).toBeNull();
  });

  it("infers a valid composition from a technical CV without asymmetric-grid", () => {
    const cv = {
      name: "Alex Rossi",
      title: "Data Scientist",
      contact: {},
      summary: "Builds data products.",
      sections: [
        {
          type: "experience",
          title: "Experience",
          entries: [{ heading: "Data Scientist", bullets: ["Built models"] }],
        },
        {
          type: "projects",
          title: "Projects",
          entries: [{ heading: "Dashboard", bullets: ["Python"] }],
        },
        {
          type: "certifications",
          title: "Certifications",
          entries: [{ heading: "AWS", bullets: [] }],
        },
      ],
      skills: {
        categories: [
          { name: "Data", items: ["Python", "SQL", "Machine Learning", "React"] },
        ],
      },
      metadata: { targetRole: "Data Scientist", tone: "modern", emphasis: [] },
    };

    const composition = inferInitialComposition(
      cv as any,
      "tech",
      createMockLogger() as any
    );

    expect(["single-column", "sidebar-left", "sidebar-right"]).toContain(
      composition.layoutId
    );
    expect(composition.layoutId).not.toBe("asymmetric-grid");
    expect(composition.themeId).toBeTruthy();
    expect(composition.sectionLayout.main.length).toBeGreaterThan(0);
  });
});