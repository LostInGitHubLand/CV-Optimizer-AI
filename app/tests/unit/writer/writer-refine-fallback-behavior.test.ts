import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/infrastructure/ai/ollama", () => ({
  queryOllama: vi.fn(),
}));

import { queryOllama } from "../../../api/infrastructure/ai/ollama";
import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

const queryOllamaMock = vi.mocked(queryOllama);

const baseJsonCv = {
  name: "Alex Rossi",
  title: "Data Analyst",
  contact: {
    email: "alex@example.com",
  },
  summary: "Data analyst focused on dashboards.",
  sections: [
    {
      type: "experience",
      title: "Professional Experience",
      entries: [
        {
          heading: "Data Analyst",
          subheading: "Acme Analytics",
          date: "2022 – Present",
          bullets: ["Built weekly dashboards"],
        },
      ],
    },
    {
      type: "certifications",
      title: "Certifications",
      entries: [
        {
          heading: "Google Data Analytics Certificate",
          subheading: "Google",
          date: "2023",
          bullets: [],
        },
      ],
    },
    {
      type: "languages",
      title: "Languages",
      entries: [
        {
          heading: "Italian",
          subheading: "Native",
          bullets: [],
        },
      ],
    },
  ],
  skills: {
    categories: [
      {
        name: "Technical",
        items: ["Python", "SQL"],
      },
    ],
  },
  metadata: {
    targetRole: "Data Analyst",
    tone: "professional",
    emphasis: ["Python", "SQL"],
    layoutDirectives: {
      sectionOrder: ["summary", "experience", "skills", "certifications", "languages"],
      topSkills: ["Python", "SQL"],
      emphasisColor: "#3182ce",
    },
  },
};

const baseMarkdown = `## Alex Rossi — Data Analyst

**Contact**

email: alex@example.com

**Summary**

Data analyst focused on dashboards.

**Experience**

### Data Analyst — Acme Analytics
2022 – Present

- Built weekly dashboards

**Certifications**

- Google Data Analytics Certificate — Google — 2023

**Languages**

- Italian — Native
`;

describe("writer refine fallback behavior", () => {
  beforeEach(() => {
    queryOllamaMock.mockReset();
  });

  it("adds languages via deterministic markdown fallback when AI refine fails", async () => {
    queryOllamaMock.mockRejectedValueOnce(new Error("AI unavailable"));

    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: baseJsonCv as any,
        currentMarkdown: baseMarkdown,
        instruction: "add languages: English B2, French fluent",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const text = JSON.stringify(result).toLowerCase();

    expect(queryOllamaMock).toHaveBeenCalledTimes(1);
    expect(text).toContain("english");
    expect(text).toContain("french");
    expect(text).toContain("b2");
    expect(text).toContain("fluent");
    expect(text).not.toContain("92%");
    expect(text).not.toContain("team of 12");
  });

  it("adds contact via deterministic markdown fallback when AI refine fails", async () => {
    queryOllamaMock.mockRejectedValueOnce(new Error("AI unavailable"));

    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: baseJsonCv as any,
        currentMarkdown: baseMarkdown,
        instruction: "add github https://github.com/alexrossi",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const text = JSON.stringify(result).toLowerCase();

    expect(queryOllamaMock).toHaveBeenCalledTimes(1);
    expect(text).toContain("github");
    expect(text).toContain("https://github.com/alexrossi");
    expect(text).not.toContain("92%");
    expect(text).not.toContain("team of 12");
  });

  it("removes explicitly requested sections without calling AI", async () => {
    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: baseJsonCv as any,
        currentMarkdown: baseMarkdown,
        instruction: "remove certifications",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    expect(queryOllamaMock).not.toHaveBeenCalled();
    expect(result.jsonCv.sections.some((s) => s.type === "certifications")).toBe(false);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("google data analytics certificate");
  });

  it("preserves sections when instruction is not removal-related", async () => {
    queryOllamaMock.mockRejectedValueOnce(new Error("AI unavailable"));

    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: baseJsonCv as any,
        currentMarkdown: baseMarkdown,
        instruction: "make the tone more concise",
        title: "Alex Rossi",
        domain: "tech" as any,
      },
      createMockLogger() as any
    );

    const sectionTypes = result.jsonCv.sections.map((s) => s.type);

    expect(sectionTypes).toContain("experience");
    expect(sectionTypes).toContain("certifications");
    expect(sectionTypes).toContain("languages");
  });
});