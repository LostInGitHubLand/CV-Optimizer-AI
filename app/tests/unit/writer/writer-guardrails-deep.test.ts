import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api/infrastructure/ai/ollama", () => ({
  queryOllama: vi.fn(async () => {
    throw new Error("mocked AI unavailable");
  }),
}));

import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

const profile = {
  name: "Alex Rossi",
  title: "Junior Data Analyst",
  contact: {
    email: "alex@example.com",
    additionalLinks: [{ label: "GitHub", url: "https://github.com/alex" }],
  },
  summary: "Junior data analyst with dashboarding and reporting experience.",
  experience: [
    {
      role: "Junior Data Analyst",
      company: "Acme Analytics",
      location: "Rome",
      startDate: "2022",
      endDate: "Present",
      description: "Built dashboards and supported reporting workflows.",
      achievements: ["Built weekly dashboards", "Coordinated reporting with sales team"],
    },
  ],
  education: [
    {
      degree: "BSc Statistics",
      institution: "University of Rome",
      field: "Statistics",
      startDate: "2018",
      year: "2021",
      grade: "110/110",
      details: "Thesis on predictive models",
    },
  ],
  skills: {
    technical: ["Python", "SQL", "Power BI"],
    soft: ["Communication"],
    languages: ["Italian (Native)", "English (Professional)"],
    tools: ["Excel"],
  },
  certifications: [
    {
      name: "Google Data Analytics Certificate",
      issuer: "Google",
      year: "2023",
      description: "Data analytics foundations",
    },
  ],
  projects: [
    {
      name: "Sales Dashboard",
      description: "Built a dashboard for sales reporting",
      technologies: ["Power BI", "SQL"],
    },
  ],
  awards: ["Finalist — Regional Data Challenge 2021"],
  publications: [],
  volunteer: ["Volunteer coach for youth basketball"],
  interests: ["Basketball", "Data visualization"],
};

const strategy = {
  keep: {
    experience: [{ index: 0, role: "Junior Data Analyst", reason: "Relevant", highlight: [] }],
    education: [{ index: 0, degree: "BSc Statistics", field: "Statistics", grade: "110/110", reason: "Relevant" }],
    skills: ["Python", "SQL", "Power BI", "Communication", "Italian (Native)", "English (Professional)", "Excel"],
    certifications: [{ index: 0, name: "Google Data Analytics Certificate", description: "Data analytics foundations", reason: "Relevant" }],
    projects: [{ index: 0, name: "Sales Dashboard", reason: "Relevant" }],
    awards: [{ index: 0, name: "Finalist — Regional Data Challenge 2021", reason: "Existing award" }],
    publications: [],
    volunteer: [{ index: 0, name: "Volunteer coach for youth basketball", reason: "Existing volunteer entry" }],
    interests: [{ index: 0, name: "Basketball", reason: "Existing interest" }, { index: 1, name: "Data visualization", reason: "Existing interest" }],
    additionalLinks: [{ index: 0, label: "GitHub", url: "https://github.com/alex", reason: "Professional link" }],
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
    emphasis: ["Python", "SQL", "Power BI"],
    tone: "professional",
    order: ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "volunteer", "interests", "languages"],
    customRules: [],
  },
  inferredStrengths: [],
  layoutDirectives: {
    sectionOrder: ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "volunteer", "interests", "languages"],
    topSkills: ["Python", "SQL", "Power BI"],
    emphasisColor: "#3182ce",
  },
  shortcomings: [],
  strengths: [],
  interviewTips: [],
};

describe("writer deep guardrails", () => {
  it("fallback writer preserves real sections and source facts", async () => {
    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert: "Data Analyst role requiring Python, SQL and dashboarding.",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const sectionTypes = result.jsonCv.sections.map((s) => s.type);

    expect(result.jsonCv.name).toBe("Alex Rossi");
    expect(sectionTypes).toEqual(
      expect.arrayContaining([
        "experience",
        "education",
        "certifications",
        "projects",
        "awards",
        "volunteer",
        "interests",
        "languages",
      ])
    );

    expect(JSON.stringify(result.jsonCv)).toContain("Finalist — Regional Data Challenge 2021");
    expect(JSON.stringify(result.jsonCv)).toContain("Google Data Analytics Certificate");
    expect(JSON.stringify(result.jsonCv)).toContain("Sales Dashboard");
  });

  it("fallback writer does not upgrade finalist, invent metrics, or invent leadership scope", async () => {
    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert: "Senior Data Analyst role requiring measurable impact, leadership and BI.",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const text = JSON.stringify(result).toLowerCase();

    expect(text).toContain("finalist");
    expect(text).not.toContain("winner");
    expect(text).not.toContain("92%");
    expect(text).not.toContain("team of 12");
    expect(text).not.toContain("managed a team");
    expect(text).not.toContain("senior data analyst");
  });

  it("refine without instruction syncs markdown without fabricating new facts", async () => {
    const currentJsonCv = {
      name: "Alex Rossi",
      title: "Junior Data Analyst",
      contact: { email: "alex@example.com" },
      summary: "Junior data analyst.",
      sections: [
        {
          type: "experience",
          title: "Professional Experience",
          entries: [
            {
              heading: "Junior Data Analyst",
              subheading: "Acme Analytics",
              date: "2022 – Present",
              bullets: ["Built weekly dashboards"],
            },
          ],
        },
      ],
      skills: { categories: [{ name: "Data", items: ["Python", "SQL"] }] },
      metadata: { targetRole: "", tone: "professional", emphasis: [] },
    };

    const currentMarkdown = `# Alex Rossi

## Professional Experience

### Junior Data Analyst — Acme Analytics
- Built weekly dashboards`;

    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: currentJsonCv as any,
        currentMarkdown,
        instruction: "",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const text = JSON.stringify(result).toLowerCase();

    expect(text).toContain("junior data analyst");
    expect(text).toContain("built weekly dashboards");
    expect(text).not.toContain("92%");
    expect(text).not.toContain("team of 12");
    expect(text).not.toContain("winner");
  });
});