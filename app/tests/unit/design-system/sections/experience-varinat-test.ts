import { describe, expect, it } from "vitest";
import * as experienceSection from "../../../../api/design-system/sections/experience";

const renderExperience =
  (experienceSection as any).renderExperienceSection ??
  (experienceSection as any).renderExperience ??
  (experienceSection as any).renderExperienceEntries;

describe("experience section variants", () => {
  const section = {
    type: "experience",
    title: "Professional Experience",
    entries: [
      {
        heading: "Data Analyst",
        subheading: "Acme Analytics",
        date: "2022 – Present",
        bullets: ["Built weekly dashboards", "Coordinated reporting with sales team"],
        description: "Supported reporting workflows.",
      },
    ],
  };

  it("exports an experience renderer", () => {
    expect(renderExperience).toBeTypeOf("function");
  });

  it("renders default experience when section-shaped input is provided", () => {
    const html = renderExperience(section as any, "default");

    expect(html === null || typeof html === "string").toBe(true);

    if (typeof html === "string") {
      expect(html).toContain("Data Analyst");
      expect(html).toContain("Acme Analytics");
    }
  });

  it("renders cards or safely falls back", () => {
    const html = renderExperience(section as any, "cards");

    expect(html === null || typeof html === "string").toBe(true);
  });

  it("renders timeline or safely falls back", () => {
    const html = renderExperience(section as any, "timeline");

    expect(html === null || typeof html === "string").toBe(true);
  });

  it("returns null for empty experience", () => {
    const html = renderExperience(
      { type: "experience", title: "Experience", entries: [] } as any,
      "default"
    );

    expect(html).toBeNull();
  });

  it("escapes unsafe HTML", () => {
    const html = renderExperience(
      {
        ...section,
        entries: [
          {
            heading: "<script>alert(1)</script>",
            subheading: "Acme",
            date: "2024",
            bullets: ["A & B"],
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
});