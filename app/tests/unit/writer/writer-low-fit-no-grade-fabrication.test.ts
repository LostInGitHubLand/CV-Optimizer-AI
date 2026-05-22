import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api/infrastructure/ai/ollama", () => ({
  queryOllama: vi.fn(async () => {
    throw new Error("mocked AI unavailable");
  }),
}));

import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

describe("writer low-fit education fabrication guardrail", () => {
  it("does not invent grades, honors, or cum laude when source education has no grade", async () => {
    const profile = {
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
      education: [
        {
          degree: "BSc Economics",
          institution: "University of Rome",
          field: "Economics",
          startDate: "2017",
          year: "2021",
          grade: "",
          details: "",
        },
      ],
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

    const strategy = {
      keep: {
        experience: [{ index: 0, role: "Retail Assistant", reason: "Transferable experience", highlight: [] }],
        education: [{ index: 0, degree: "BSc Economics", field: "Economics", grade: "", reason: "Academic background" }],
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
        order: ["summary", "education", "experience", "skills"],
        customRules: [],
      },
      inferredStrengths: [],
      layoutDirectives: {
        sectionOrder: ["summary", "education", "experience", "skills"],
        topSkills: ["Communication", "Excel"],
        emphasisColor: "#3182ce",
      },
      shortcomings: [],
      strengths: [],
      interviewTips: [],
    };

    const result = await runWriter(
      {
        mode: "main",
        profile: profile as any,
        strategy: strategy as any,
        jobAdvert:
          "We are hiring a highly selective Investment Analyst. Ideal candidates have top academic performance, honors, distinction, strong quantitative credentials and excellent grades.",
        title: "Marco Verdi",
        domain: "unknown" as any,
      },
      createMockLogger() as any
    );

    const text = JSON.stringify(result).toLowerCase();

    expect(text).toContain("bsc economics");
    expect(text).toContain("university of rome");

    expect(text).not.toContain("110/110");
    expect(text).not.toContain("cum laude");
    expect(text).not.toContain("lode");
    expect(text).not.toContain("honors");
    expect(text).not.toContain("distinction");
    expect(text).not.toContain("gpa");
  });
});