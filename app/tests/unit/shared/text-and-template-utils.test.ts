import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  getContactIcon,
  isTruthy,
  resolvePath,
} from "../../../api/design-system/shared/utils";
import {
  buildLanguageInstruction,
  detectLanguageHint,
  normalizeText,
  stemWord,
  stripUndefined,
  tokenizeAndStem,
} from "../../../api/agents/text-utils";

describe("shared rendering utils", () => {
  it("escapes html entities", () => {
    expect(escapeHtml(`<a href="x">A&B</a>`)).toContain("&lt;a");
    expect(escapeHtml(`"quote"`)).toContain("&quot;");
  });

  it("evaluates truthiness consistently", () => {
    expect(isTruthy(" text ")).toBe(true);
    expect(isTruthy("")).toBe(false);
    expect(isTruthy([])).toBe(false);
    expect(isTruthy([1])).toBe(true);
    expect(isTruthy({})).toBe(false);
    expect(isTruthy({ a: 1 })).toBe(true);
  });

  it("resolves nested paths", () => {
    const ctx = { user: { profile: { name: "Alex" } }, this: "current" };

    expect(resolvePath(ctx, "user.profile.name")).toBe("Alex");
    expect(resolvePath(ctx, "this")).toBe("current");
    expect(resolvePath(ctx, "missing.path")).toBeUndefined();
  });

  it("returns known and fallback contact icons", () => {
    expect(getContactIcon("email").faClass).toContain("envelope");
    expect(getContactIcon("unknown").icon).toBe("◆");
  });
});

describe("agent text utils", () => {
  it("normalizes text", () => {
    expect(normalizeText("Hello,   WORLD!")).toBe("hello world");
  });

  it("stems common English suffixes", () => {
    expect(stemWord("managing")).toBe("manag");
    expect(stemWord("skills")).toBe("skill");
  });

  it("tokenizes and stems text", () => {
    const tokens = tokenizeAndStem("Managing dashboards with Python");

    expect(tokens).toContain("manag");
    expect(tokens).toContain("python");
  });

  it("detects non-English hint using non-ascii ratio", () => {
    expect(detectLanguageHint("Hello world")).toBe("en");
    expect(detectLanguageHint("你好你好你好你好你好")).toBe("non-english");
  });

  it("strips undefined/null placeholders recursively", () => {
    const cleaned = stripUndefined({
      a: "undefined",
      b: ["null", "ok"],
      c: { d: "value" },
    });

    expect(cleaned).toEqual({
      a: "",
      b: ["", "ok"],
      c: { d: "value" },
    });
  });

  it("builds language instruction only for non-English adverts", () => {
    expect(buildLanguageInstruction("Hello world")).toBe("");
    expect(buildLanguageInstruction("你好你好你好你好你好")).toContain("LANGUAGE INSTRUCTION");
  });
});