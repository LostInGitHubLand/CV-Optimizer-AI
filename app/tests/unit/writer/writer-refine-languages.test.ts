import { describe, expect, it } from "vitest";
import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

describe("writer refine language sync", () => {
  it("syncs languages from markdown", async () => {
    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: {
          name: "Alex",
          title: "Test",
          contact: {},
          summary: "",
          sections: [],
          skills: { categories: [] },
          metadata: { targetRole: "", tone: "professional", emphasis: [] },
        } as any,
        currentMarkdown: `## Languages

- Italian — Native
- English — B2`,
        instruction: "",
        title: "Alex",
      },
      createMockLogger() as any
    );

    const langSection = result.jsonCv.sections.find((s) => s.type === "languages");

    expect(langSection).toBeTruthy();
    expect(langSection.entries.length).toBe(2);
  });
});