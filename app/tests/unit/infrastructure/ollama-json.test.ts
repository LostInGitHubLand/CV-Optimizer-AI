import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ollama JSON helpers", () => {
  it("parses fenced JSON responses", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: "```json\n{\"ok\":true,\"value\":3}\n```", prompt_eval_count: 2, eval_count: 4 }),
    });

    const { chatWithOllamaJSON } = await import("../../../api/infrastructure/ai/ollama");
    const result = await chatWithOllamaJSON<{ ok: boolean; value: number }>("system", "user");

    expect(result).toEqual({ ok: true, value: 3 });
  });

  it("reports unavailable Ollama when tags endpoint fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    const { isOllamaAvailable } = await import("../../../api/infrastructure/ai/ollama");
    await expect(isOllamaAvailable()).resolves.toBe(false);
  });

  it("checks model availability through /api/tags", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: "qwen3:latest" }] }),
    });

    const { isModelAvailable } = await import("../../../api/infrastructure/ai/ollama");
    await expect(isModelAvailable("qwen3" as any)).resolves.toBe(true);
  });
});
