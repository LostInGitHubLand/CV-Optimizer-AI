import { describe, it, expect } from "vitest";
import * as languagesSection from "../../../../api/design-system/sections/languages";

const renderLanguages =
  (languagesSection as any).renderLanguagesSection ??
  (languagesSection as any).renderLanguages ??
  (languagesSection as any).renderLanguageSection;

describe("languages section", () => {
  const mockLanguages = [
    { language: "English", level: "Professional" },
    { language: "Italian", level: "Native" },
  ];

  it("renders language list", () => {
    const html = renderLanguages(mockLanguages as any, "default");

    expect(html).toContain("English");
    expect(html).toContain("Professional");
    expect(html).toContain("Italian");
    expect(html).toContain("Native");
  });

  it("renders proficiency bars", () => {
    const html = renderLanguages(mockLanguages as any, "proficiency-bars");

    expect(html).toContain("English");
    expect(html).toContain("Italian");
    expect(html).toContain("width:80%");
    expect(html).toContain("width:100%");
  });
});