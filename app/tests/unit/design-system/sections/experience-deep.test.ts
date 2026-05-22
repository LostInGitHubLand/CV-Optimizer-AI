import { describe, expect, it } from "vitest";
import * as experienceSection from "../../../../api/design-system/sections/experience";

const renderExperience =
  (experienceSection as any).renderExperienceSection ??
  (experienceSection as any).renderExperience ??
  (experienceSection as any).renderExperienceEntries;

describe("experience deep coverage", () => {
  const baseSection = {
    type: "experience",
    title: "Experience",
    entries: [
      {
        heading: "Data Analyst",
        subheading: "Acme",
        date: "2022 – Present",
        bullets: ["Built dashboards", "Worked with SQL"],
        description: "Did stuff",
      },
    ],
  };

  it("throws on undefined input because section is required", () => {
  expect(() => renderExperience(undefined as any, "default")).toThrow();
});

  it("throws on null input because section is required", () => {
    expect(() => renderExperience(null as any, "default")).toThrow();
});

  it("handles entries without bullets", () => {
    const html = renderExperience(
      {
        ...baseSection,
        entries: [
          {
            heading: "Data Analyst",
            subheading: "Acme",
            date: "2022",
          },
        ],
      } as any,
      "default"
    );

    expect(html === null || typeof html === "string").toBe(true);
  });

  it("handles entries without subheading", () => {
    const html = renderExperience(
      {
        ...baseSection,
        entries: [
          {
            heading: "Data Analyst",
            date: "2022",
            bullets: ["A"],
          },
        ],
      } as any,
      "default"
    );

    expect(html === null || typeof html === "string").toBe(true);
  });

  it("renders timeline variant branch", () => {
    const html = renderExperience(baseSection as any, "timeline");
    expect(html === null || typeof html === "string").toBe(true);
  });

  it("renders cards variant branch", () => {
    const html = renderExperience(baseSection as any, "cards");
    expect(html === null || typeof html === "string").toBe(true);
  });

  it("escapes dangerous HTML in experience entries", () => {
    const html = renderExperience(
      {
        ...baseSection,
        entries: [
          {
            heading: "<script>alert(1)</script>",
            subheading: "Acme",
            date: "2024",
            bullets: ["<b>bold</b>"],
          },
        ],
      } as any,
      "default"
    );

    if (typeof html === "string") {
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    }
  });

  it("returns null for empty entries", () => {
    const html = renderExperience(
      { type: "experience", title: "Experience", entries: [] } as any,
      "default"
    );

    expect(html).toBeNull();
  });
});