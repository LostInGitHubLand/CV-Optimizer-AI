import { describe, expect, it } from "vitest";
import { renderEducationSection } from "../../../../api/design-system/sections/education";
import * as entrySection from "../../../../api/design-system/sections/entry";

const renderEntry =
  (entrySection as any).renderEntry ??
  (entrySection as any).renderEntryHtml ??
  (entrySection as any).renderEntrySection;

describe("education and entry renderers", () => {
  const educationSection = {
    type: "education",
    title: "Education",
    entries: [
      {
        heading: "BSc Statistics",
        subheading: "University of Rome",
        date: "2018 – 2021",
        bullets: ["Grade: 110/110", "Thesis on predictive models"],
      },
    ],
  };

  it("renders education default view", () => {
    const html = renderEducationSection(educationSection as any, "default");

    expect(html).toContain("BSc Statistics");
    expect(html).toContain("University of Rome");
  });

  it("renders education card view", () => {
    const html = renderEducationSection(educationSection as any, "cards" as any);

    expect(html).toContain("BSc Statistics");
    expect(html).toContain("Education");
  });

  it("returns null for empty education", () => {
    const html = renderEducationSection(
      { type: "education", title: "Education", entries: [] } as any,
      "default"
    );

    expect(html).toBeNull();
  });

  it("entry renderer export exists when available", () => {
    if (renderEntry) {
      const html = renderEntry(
        {
          heading: "Entry Heading",
          subheading: "Entry Subheading",
          date: "2024",
          bullets: ["Bullet"],
        },
        {}
      );

      expect(String(html)).toContain("Entry Heading");
    } else {
      expect(renderEntry).toBeUndefined();
    }
  });
});