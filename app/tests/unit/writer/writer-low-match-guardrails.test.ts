import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api/infrastructure/ai/ollama", () => ({
  queryOllama: vi.fn(async () => {
    throw new Error("mocked Ollama unavailable");
  }),
}));

import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

const weakProfile = {
  name: "Marco Verdi",
  title: "Retail Assistant",
  contact: { email: "marco@example.com", additionalLinks: [] },
  summary: "Retail assistant with customer service experience.",
  experience: [
    {
      role: "Retail Assistant",
      company: "City Store",
      location: "Rome",
      startDate: "2021",
      endDate: "Present",
      description: "Assisted customers and handled store operations.",
      achievements: ["Supported customers", "Maintained store organization"],
    },
  ],
  education: [],
  skills: {
    technical: ["Excel"],
    soft: ["Communication", "Reliability"],
    languages: ["Italian"],
    tools: [],
  },
  certifications: [],
  projects: [],
  awards: [],
  publications: [],
  volunteer: [],
  interests: [],
};

const safeStrategy = {
  keep: {
    experience: [{ index: 0, role: "Retail Assistant", reason: "Transferable customer-facing experience", highlight: [] }],
    education: [],
    skills: ["Excel", "Communication", "Reliability", "Italian"],
    certifications: [],
    projects: [],
    awards: [],
    publications: [],
    volunteer: [],
    interests: [],
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
    emphasis: ["Communication", "Reliability"],
    tone: "professional",
    order: ["summary", "experience", "skills", "education"],
    customRules: [],
  },
  inferredStrengths: [],
  layoutDirectives: {
    sectionOrder: ["summary", "experience", "skills", "education"],
    topSkills: ["Excel", "Communication"],
    emphasisColor: "#3182ce",
  },
  shortcomings: [],
  strengths: [],
  interviewTips: [],
};

describe("writer low-match guardrails", () => {
  it("does not fabricate data analyst experience when AI falls back", async () => {
    const result = await runWriter(
      {
        mode: "main",
        profile: weakProfile as any,
        strategy: safeStrategy as any,
        jobAdvert: "We need a Data Analyst with Python, SQL, Power BI and dashboards.",
        title: "Marco Verdi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const serialized = JSON.stringify(result).toLowerCase();

    expect(serialized).toContain("retail assistant");
    expect(serialized).toContain("city store");

    expect(serialized).not.toContain("built sql dashboards");
    expect(serialized).not.toContain("automated python");
    expect(serialized).not.toContain("power bi experience");
    expect(serialized).not.toContain("92%");
    expect(serialized).not.toContain("team of 12");
  });

  it("preserves existing skills without adding job-advert-only skills", async () => {
    const result = await runWriter(
      {
        mode: "main",
        profile: weakProfile as any,
        strategy: safeStrategy as any,
        jobAdvert: "Python SQL Power BI dashboarding business intelligence",
        title: "Marco Verdi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const skills = JSON.stringify(result.jsonCv.skills).toLowerCase();

    expect(skills).toContain("excel");
    expect(skills).toContain("communication");
    expect(skills).not.toContain("python");
    expect(skills).not.toContain("sql");
    expect(skills).not.toContain("power bi");
  });
});