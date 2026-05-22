import { describe, expect, it, vi } from "vitest";

vi.mock("../../../api/infrastructure/ai/ollama", () => ({
  queryOllama: vi.fn(async () => {
    throw new Error("AI down");
  }),
}));

import { runWriter } from "../../../api/agents/writer";
import { createMockLogger } from "../../helpers/mock-logger";

describe("writer fallback", () => {
  it("falls back to deterministic builder when AI fails", async () => {
    const result = await runWriter(
      {
        mode: "main",
        profile: {
          name: "Alex",
          contact: {},
          experience: [],
          education: [],
          skills: {},
        } as any,
        strategy: {
          keep: { experience: [], education: [], skills: [] },
          strategy: { tone: "professional", emphasis: [], order: [] },
        } as any,
        jobAdvert: "test",
        title: "Alex",
      },
      createMockLogger() as any
    );

    expect(result.markdown).toContain("Alex");
    expect(result.jsonCv.name).toBe("Alex");
  });
});