import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../api/infrastructure/ai/ollama", () => ({
  queryOllama: vi.fn(),
}));

import { queryOllama } from "../../../api/infrastructure/ai/ollama";
import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

const queryOllamaMock = vi.mocked(queryOllama);

const profile = {
  name: "Alex Rossi",
  title: "Junior Data Analyst",
  contact: { email: "alex@example.com", additionalLinks: [] },
  summary: "Junior data analyst with dashboarding experience.",
  experience: [
    {
      role: "Junior Data Analyst",
      company: "Acme Analytics",
      location: "Rome",
      startDate: "2022",
      endDate: "Present",
      description: "Built dashboards and supported reporting workflows.",
      achievements: ["Built weekly dashboards"],
    },
  ],
  education: [],
  skills: {
    technical: ["Python", "SQL"],
    soft: ["Communication"],
    languages: ["Italian"],
    tools: ["Excel"],
  },
  certifications: [],
  projects: [],
  awards: [],
  publications: [],
  volunteer: [],
  interests: ["Basketball"],
};

const strategy = {
  keep: {
    experience: [{ index: 0, role: "Junior Data Analyst", reason: "Relevant", highlight: [] }],
    education: [],
    skills: ["Python", "SQL", "Communication", "Italian", "Excel"],
    certifications: [],
    projects: [],
    awards: [],
    publications: [],
    volunteer: [],
    interests: [{ index: 0, name: "Basketball", reason: "Existing interest" }],
    additionalLinks: [],
  },
  remove: {
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    awards: [],
    publications: [],
    volunteer: [],
    interests: [],
    additionalLinks: [],
  },
  strategy: {
    emphasis: ["Python", "SQL"],
    tone: "professional",
    order: ["summary", "experience", "skills", "interests", "languages"],
    customRules: [],
  },
  inferredStrengths: [],
  layoutDirectives: {
    sectionOrder: ["summary", "experience", "skills", "interests", "languages"],
    topSkills: ["Python", "SQL"],
    emphasisColor: "#3182ce",
  },
  shortcomings: [],
  strengths: [],
  interviewTips: [],
};

describe("writer AI JSON recovery", () => {
  beforeEach(() => {
    queryOllamaMock.mockReset();
  });

  it("uses AI success path when qwen3 returns valid JSON", async () => {
    queryOllamaMock.mockResolvedValueOnce(
      JSON.stringify({
        markdown: "# Alex Rossi\n\nImproved but faithful CV.",
        jsonCv: {
          name: "Alex Rossi",
          title: "Junior Data Analyst",
          contact: { email: "alex@example.com" },
          summary: "Improved but faithful summary.",
          sections: [
            {
              type: "experience",
              title: "Professional Experience",
              entries: [
                {
                  heading: "Junior Data Analyst",
                  subheading: "Acme Analytics",
                  date: "2022 – Present",
                  bullets: ["Developed weekly dashboards"],
                },
              ],
            },
            {
              type: "interests",
              title: "Interests",
              entries: [{ heading: "Basketball", bullets: [] }],
            },
            {
              type: "languages",
              title: "Languages",
              entries: [{ heading: "Italian", bullets: [] }],
            },
          ],
          skills: {
            categories: [{ name: "Technical", items: ["Python", "SQL"] }],
          },
          metadata: {
            targetRole: "Python",
            tone: "professional",
            emphasis: ["Python", "SQL"],
            layoutDirectives: {
              sectionOrder: ["summary", "experience", "skills", "interests", "languages"],
              topSkills: ["Python", "SQL"],
              emphasisColor: "#3182ce",
            },
          },
        },
      })
    );

    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert: "Data Analyst role requiring Python and SQL.",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    expect(queryOllamaMock).toHaveBeenCalledTimes(1);
    expect(result.markdown).toContain("Improved but faithful CV");
    expect(result.jsonCv.sections.some((s) => s.type === "experience")).toBe(true);
    expect(result.jsonCv.skills.categories[0].items).toContain("Python");
  });

  it("recovers when qwen3 returns JSON with raw control characters", async () => {
    const brokenJson =
      `{"markdown":"# Alex Rossi\u0001 Improved CV","jsonCv":{"name":"Alex Rossi","title":"Junior Data Analyst","contact":{"email":"alex@example.com"},"summary":"Summary","sections":[],"skills":{"categories":[{"name":"Technical","items":["Python","SQL"]}]},"metadata":{"targetRole":"Python","tone":"professional","emphasis":["Python"],"layoutDirectives":{"sectionOrder":["summary","experience","skills"],"topSkills":["Python"],"emphasisColor":"#3182ce"}}}}`;

    queryOllamaMock.mockResolvedValueOnce(brokenJson);

    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert: "Data Analyst role.",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    expect(queryOllamaMock).toHaveBeenCalledTimes(1);
    expect(result.jsonCv.name).toBe("Alex Rossi");
    expect(result.markdown).toContain("Alex Rossi");
  });

  it("falls back deterministically when qwen3 returns no JSON", async () => {
    queryOllamaMock.mockResolvedValueOnce("not json at all");

    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert: "Data Analyst role.",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    expect(queryOllamaMock).toHaveBeenCalledTimes(1);
    expect(result.jsonCv.name).toBe("Alex Rossi");
    expect(result.markdown).toContain("Alex Rossi");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("not json at all");
  });

  it("restores skills, languages, interests and layout directives if AI drops them", async () => {
    queryOllamaMock.mockResolvedValueOnce(
      JSON.stringify({
        markdown: "# Alex Rossi\n\nAI tried to reduce content.",
        jsonCv: {
          name: "Alex Rossi",
          title: "Junior Data Analyst",
          contact: { email: "alex@example.com" },
          summary: "Reduced summary.",
          sections: [
            {
              type: "experience",
              title: "Professional Experience",
              entries: [
                {
                  heading: "Junior Data Analyst",
                  subheading: "",
                  date: "",
                  bullets: ["Developed dashboards"],
                },
              ],
            },
          ],
          skills: { categories: [] },
          metadata: {
            targetRole: "Python",
            tone: "professional",
            emphasis: ["Python"],
          },
        },
      })
    );

    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert: "Data Analyst role.",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const sectionTypes = result.jsonCv.sections.map((s) => s.type);

    expect(result.jsonCv.skills.categories.length).toBeGreaterThan(0);
    expect(sectionTypes).toContain("interests");
    expect(sectionTypes).toContain("languages");
    expect(result.jsonCv.metadata.layoutDirectives).toBeTruthy();

    const experience = result.jsonCv.sections.find((s) => s.type === "experience");
    expect(experience?.entries[0].subheading).toBe("Acme Analytics");
    expect(experience?.entries[0].date).toContain("2022");
  });
});