import { describe, expect, it } from "vitest";
import {
  renderSection,
  renderSummarySection,
  renderInterestsSection,
} from "../../../api/design-system/sections/section";

describe("section dispatcher", () => {
  it("renders generic section with card variant", () => {
    const html = renderSection(
      {
        type: "projects",
        title: "Projects",
        entries: [{ heading: "Portfolio Site", bullets: ["React"] }],
      } as any,
      { variant: "cards", order: 2 }
    );

    expect(html).toContain("Portfolio Site");
    expect(html).toContain('data-variant="cards"');
    expect(html).toContain("order:2");
  });

  it("returns null for empty non-summary sections", () => {
    const html = renderSection({ type: "projects", title: "Projects", entries: [] } as any);

    expect(html).toBeNull();
  });

  it("renders summary safely", () => {
    const html = renderSummarySection("Data analyst <strong>unsafe</strong>");

    expect(html).toContain("Professional Summary");
    expect(html).toContain("&lt;strong&gt;");
  });

  it("returns empty string for empty summary", () => {
    expect(renderSummarySection("")).toBe("");
  });

  it("renders interests tags", () => {
    const html = renderInterestsSection({
      type: "interests",
      title: "Interests",
      entries: [{ heading: "Open Source" }, { heading: "AI" }],
    } as any);

    expect(html).toContain("Open Source");
    expect(html).toContain("cv-interest-item");
  });
});