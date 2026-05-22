import { describe, expect, it } from "vitest";
import { sanitizeCvHtml } from "../../../api/infrastructure/security";

describe("HTML sanitizer URL filtering", () => {
  it("removes dangerous link protocols but preserves normal HTTPS links and style blocks", () => {
    const html = `<!DOCTYPE html><html><head><style>.cv{color:red}</style></head><body>
      <a href="javascript:alert(1)">bad-js</a>
      <a href="data:text/html,<script>alert(1)</script>">bad-data</a>
      <a href="https://example.com/profile">good</a>
      <p style="font-weight:bold">CV text</p>
    </body></html>`;

    const clean = sanitizeCvHtml(html).toLowerCase();

    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("data:text/html");
    expect(clean).toContain("https://example.com/profile");
    expect(clean).toContain("<style>");
    expect(clean).toContain("font-weight");
  });
});
