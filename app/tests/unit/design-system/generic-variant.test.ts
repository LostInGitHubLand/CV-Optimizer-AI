import { describe, expect, it } from "vitest";
import { renderEntrySectionWithVariant } from "../../../api/design-system/sections/generic-variant";

const section = {
  type: "projects",
  title: "Projects",
  entries: [
    {
      heading: "Analytics Dashboard",
      subheading: "Internal Tool",
      date: "2024",
      description: "Built dashboard",
      bullets: ["Python", "SQL"],
    },
  ],
};

describe("generic entry variant renderer", () => {
  it("renders default variant", () => {
    const html = renderEntrySectionWithVariant(section as any, "default");

    expect(html).toContain("Analytics Dashboard");
    expect(html).toContain("Projects");
    expect(html).toContain("Python");
  });

  it("renders cards variant", () => {
    const html = renderEntrySectionWithVariant(section as any, "cards");

    expect(html).toContain('data-variant="cards"');
    expect(html).toContain("cv-entry--card");
  });

  it("renders timeline variant", () => {
    const html = renderEntrySectionWithVariant(section as any, "timeline");

    expect(html).toContain('data-variant="timeline"');
    expect(html).toContain("cv-timeline-entry");
  });

  it("renders editorial-flow variant", () => {
    const html = renderEntrySectionWithVariant(section as any, "editorial-flow");

    expect(html).toContain('data-variant="editorial-flow"');
    expect(html).toContain("cv-entry--editorial");
  });

  it("returns null for empty sections", () => {
    const html = renderEntrySectionWithVariant({ ...section, entries: [] } as any);

    expect(html).toBeNull();
  });

  it("escapes unsafe HTML", () => {
    const html = renderEntrySectionWithVariant({
      ...section,
      entries: [{ heading: "<script>alert(1)</script>", bullets: ["A & B"] }],
    } as any);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});