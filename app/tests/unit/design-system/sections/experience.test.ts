import { describe, it, expect } from "vitest";
import * as experienceSection from "../../../../api/design-system/sections/experience";

const renderExperience =
  (experienceSection as any).renderExperienceSection ??
  (experienceSection as any).renderExperience ??
  (experienceSection as any).renderExperienceEntries;

describe("experience section", () => {
  const mockEntries = [
    {
      heading: "Data Analyst",
      subheading: "Acme",
      date: "2022 – Present",
      bullets: ["Worked on dashboards"],
    },
  ];

  it("returns null for unsupported direct entry rendering", () => {
    const html = renderExperience(mockEntries as any, "default");

    expect(html).toBeNull();
  });

  it("returns null for unsupported timeline variant", () => {
    const html = renderExperience(mockEntries as any, "timeline");

    expect(html).toBeNull();
  });
});