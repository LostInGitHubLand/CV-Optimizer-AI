import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = `<!doctype html><html><head><title>Alex Rossi - Portfolio</title></head><body>
<h1>Alex Rossi</h1>
<h2>Data Scientist</h2>
<p>Data analyst focused on dashboards, Python and SQL automation.</p>
<a href="https://github.com/alexrossi">GitHub</a>
<a href="mailto:alex@example.com">Email</a>
</body></html>`;

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => html }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scraping profile", () => {
  it("extracts text content from a simple public profile page", async () => {
    const { scrapeProfile } = await import("../../../api/infrastructure/scraping");
    const profile = await scrapeProfile("https://example.com/alex");

    const serialized = JSON.stringify(profile).toLowerCase();
    expect(serialized).toContain("alex");
    expect(serialized).toContain("data");
  });
});
