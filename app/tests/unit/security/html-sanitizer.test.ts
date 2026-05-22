import { describe, expect, it } from "vitest";
import { sanitizeCvHtml } from "../../../api/infrastructure/security";

describe("HTML sanitizer", () => {
  it("removes executable tags and event handlers while preserving CV layout tags", () => {
    const dirty = `<!doctype html><html><head><style>.cv{color:red}</style><script>alert("x")</script></head><body><div class="cv" onclick="alert('x')"><a href="javascript:alert(1)">bad</a><iframe src="https://evil.example"></iframe><p>Safe CV text</p></div></body></html>`;
    const clean = sanitizeCvHtml(dirty);
    expect(clean).toContain("<style");
    expect(clean).toContain("Safe CV text");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
  });
});
