import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEMANTIC_STATE,
  serializeSemanticState,
  deserializeSemanticState,
} from "../../../api/design-system/semantic/state";

describe("semantic state", () => {
  it("serializes state correctly", () => {
    const str = serializeSemanticState(DEFAULT_SEMANTIC_STATE);
    expect(typeof str).toBe("string");
    expect(str).toContain("modern");
  });

  it("deserializes valid state", () => {
    const raw = JSON.stringify({
      tone: "minimal",
      density: "compact",
    });

    const state = deserializeSemanticState(raw);

    expect(state.tone).toBe("minimal");
    expect(state.density).toBe("compact");
  });

  it("merges with default state", () => {
    const raw = JSON.stringify({ tone: "creative" });

    const state = deserializeSemanticState(raw);

    expect(state.tone).toBe("creative");
    expect(state.density).toBe("normal"); // default preserved
  });

  it("returns default on invalid JSON", () => {
    const state = deserializeSemanticState("{invalid");

    expect(state).toEqual(DEFAULT_SEMANTIC_STATE);
  });

  it("returns default on null/undefined", () => {
    expect(deserializeSemanticState(null)).toEqual(DEFAULT_SEMANTIC_STATE);
    expect(deserializeSemanticState(undefined)).toEqual(DEFAULT_SEMANTIC_STATE);
  });
});