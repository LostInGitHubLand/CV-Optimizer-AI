import { describe, expect, it, vi } from "vitest";
import { runWriter } from "../../../api/agents/writer";
import { runRuleBasedAnalysis } from "../../../api/agents/analyst";
import { baseJobAdvert, baseProfile } from "../../fixtures/profiles/base-profile";
import { createMockLogger } from "../../helpers/mock-logger";
import { collectFabricationIssues } from "../../helpers/fabrication-detector";

vi.mock("../../../api/infrastructure/ai/ollama", async () => ({
  queryOllama: vi.fn(async () => { throw new Error("mocked Ollama unavailable"); }),
  isOllamaAvailable: vi.fn(async () => false),
  chatWithOllamaJSON: vi.fn(),
}));

describe("Writer deterministic fallback", () => {
  it("generates JsonCv + Markdown without invented metrics or role distortions", async () => {
    const log = createMockLogger() as any;
    const strategy = runRuleBasedAnalysis(baseJobAdvert, baseProfile as any, "tech" as any, log).jsonStrategy;
    const result = await runWriter({ mode: "main", profile: baseProfile as any, strategy, jobAdvert: baseJobAdvert, title: "Data Analyst", domain: "tech" as any }, log);
    expect(result.markdown).toContain("Alex Rossi");
    expect(result.jsonCv.sections.some((s) => s.type === "experience")).toBe(true);
    const outputText = `${result.markdown}\n${JSON.stringify(result.jsonCv)}`;
    expect(collectFabricationIssues(JSON.stringify(baseProfile), outputText)).toEqual([]);
    expect(outputText).toContain("Finalist");
    expect(outputText).not.toMatch(/Winner/i);
  });
});
