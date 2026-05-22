import { describe, expect, it } from "vitest";
import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

describe("writer refine removal", () => {
  it("removes section when explicitly requested", async () => {
    const result = await runWriter(
      {
        mode: "refine",
        currentJsonCv: {
          name: "Alex",
          title: "Test",
          contact: {},
          summary: "",
          sections: [
            { type: "awards", title: "Awards", entries: [{ heading: "Test", bullets: [] }] },
          ],
          skills: { categories: [] },
          metadata: { targetRole: "", tone: "professional", emphasis: [] },
        } as any,
        currentMarkdown: `## Awards\n\n- Test`,
        instruction: "remove awards section",
        title: "Alex",
      },
      createMockLogger() as any
    );

    expect(result.jsonCv.sections.find((s) => s.type === "awards")).toBeUndefined();
    expect(result.markdown.toLowerCase()).not.toContain("awards");
  });
});