import { describe, expect, it } from "vitest";
import { fallbackExtraction } from "../../../api/agents/fetcher";
import { createMockLogger } from "../../helpers/mock-logger";

describe("Fetcher fallback enrichment", () => {
  it("extracts contact links, technical skills, languages, and projects without Ollama", () => {
    const input = `
Alex Rossi
alex@example.com
https://github.com/alexrossi
Portfolio: https://alex.dev

Summary
Data analyst focused on dashboards and automation.

Skills
Python, SQL, React, English Native, Italian Fluent, Leadership

Projects
Customer Analytics Dashboard built with Python and SQL
`;

    const result = fallbackExtraction(input, null, createMockLogger() as any);
    const profile = result.jsonProfile;

    expect(profile.name).toBe("Alex Rossi");
    expect(profile.contact.email).toBe("alex@example.com");
    expect(profile.contact.additionalLinks?.some((l) => l.label === "GitHub")).toBe(true);
    expect(profile.skills.technical.join(" ")).toMatch(/python/i);
    expect(profile.skills.technical.join(" ")).toMatch(/sql/i);
    expect(profile.skills.languages.join(" ")).toMatch(/english/i);
    expect(profile.skills.soft.join(" ")).toMatch(/leadership/i);
    expect(profile.projects.length).toBeGreaterThanOrEqual(1);
  });

  it("uses raw profile fallback fields when text does not contain a clear name", () => {
    const rawProfile = {
      name: "Maria Bianchi",
      title: "Frontend Engineer",
      about: "Builds accessible interfaces.",
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      projects: [],
    } as any;

    const result = fallbackExtraction("Skills\nTypeScript, React", rawProfile, createMockLogger() as any);

    expect(result.jsonProfile.name).toBe("Maria Bianchi");
    expect(result.jsonProfile.title).toBe("Frontend Engineer");
    expect(result.jsonProfile.summary).toContain("accessible interfaces");
  });
});
