import { describe, expect, it } from "vitest";
import * as languagesSection from "../../../../api/design-system/sections/languages";

const renderLanguages =
  (languagesSection as any).renderLanguagesSection ??
  (languagesSection as any).renderLanguages ??
  (languagesSection as any).renderLanguageSection;

describe("languages section variants", () => {
  const languages = [
    { language: "English", level: "Professional" },
    { language: "Italian", level: "Native" },
    { language: "French", level: "B2" },
  ];

  it("renders default language list", () => {
    const html = renderLanguages(languages as any, "default");

    expect(html).toContain("English");
    expect(html).toContain("Professional");
    expect(html).toContain("Italian");
  });

  it("renders proficiency list", () => {
    const html = renderLanguages(languages as any, "proficiency-list");

    expect(html).toContain("English");
    expect(html).toContain("Professional");
    expect(html).toContain("French");
  });

  it("renders proficiency bars without showing percentages as text", () => {
    const html = renderLanguages(languages as any, "proficiency-bars");

    expect(html).toContain("English");
    expect(html).toContain("Italian");
    expect(html).toContain("width:80%");
    expect(html).toContain("width:100%");
    expect(html).not.toContain("English 80%");
    expect(html).not.toContain("(80%)");
  });

  it("uses explicit numeric overrides for bars", () => {
    const html = renderLanguages(
      languages as any,
      "proficiency-bars",
      { English: 75, Italian: 95, French: 60 }
    );

    expect(html).toContain("width:75%");
    expect(html).toContain("width:95%");
    expect(html).toContain("width:60%");
  });

  it("handles languages without level", () => {
    const html = renderLanguages(
      [{ language: "Spanish" }] as any,
      "default"
    );

    expect(html).toContain("Spanish");
  });

  it("returns null or empty output for empty languages", () => {
    const html = renderLanguages([] as any, "default");

    expect(html === null || html === "").toBe(true);
  });

});