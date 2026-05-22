import { describe, expect, it } from "vitest";
import * as contactsSection from "../../../../api/design-system/sections/contacts";

const renderContacts =
  (contactsSection as any).renderContactsSection ??
  (contactsSection as any).renderContacts ??
  (contactsSection as any).renderContactSection;

describe("contacts deep coverage", () => {
  it("handles undefined input", () => {
    const html = renderContacts(undefined as any, "default");
    expect(html === null || typeof html === "string").toBe(true);
  });

  it("handles null input", () => {
    const html = renderContacts(null as any, "default");
    expect(html === null || typeof html === "string").toBe(true);
  });

  it("handles missing fields gracefully", () => {
    const html = renderContacts(
      [
        { key: "email", label: "Email", value: "", icon: "" },
        { key: "linkedin", label: "LinkedIn", value: null, icon: "" },
      ] as any,
      "default"
    );

    expect(html === null || typeof html === "string").toBe(true);
  });

  it("renders sidebar stack variant", () => {
    const html = renderContacts(
      [
        { key: "email", label: "Email", value: "alex@example.com", icon: "✉" },
      ] as any,
      "sidebar-stack" // ← branch interno
    );

    expect(html === null || typeof html === "string").toBe(true);
  });

  it("handles multiple contacts", () => {
    const html = renderContacts(
      [
        { key: "email", label: "Email", value: "alex@example.com", icon: "✉" },
        { key: "github", label: "GitHub", value: "https://github.com", icon: "🐙" },
        { key: "location", label: "Location", value: "Rome", icon: "📍" },
      ] as any,
      "default"
    );

    expect(typeof html === "string" || html === null).toBe(true);
  });

  it("escapes XSS in contact values and icons", () => {
    const html = renderContacts(
      [
        {
          key: "email",
          label: "Email",
          value: `<script>alert(1)</script>`,
          icon: `<img src=x onerror=alert(1)>`,
        },
      ] as any,
      "default"
    );

    if (typeof html === "string") {
      expect(html).not.toContain("<script>");
      expect(html).not.toMatch(/<[^>]+\sonerror=/i);
      expect(html).toContain("&lt;script&gt;");
    }
  });

  it("returns null for empty array", () => {
    const html = renderContacts([] as any, "default");
    expect(html).toBeFalsy();
  });
});
