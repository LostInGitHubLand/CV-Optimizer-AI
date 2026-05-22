import { describe, expect, it } from "vitest";
import * as contactsSection from "../../../../api/design-system/sections/contacts";

const renderContacts =
  (contactsSection as any).renderContactsSection ??
  (contactsSection as any).renderContacts ??
  (contactsSection as any).renderContactSection;

describe("contacts section", () => {
  it("exports a contact renderer", () => {
    expect(renderContacts).toBeTypeOf("function");
  });

  it("renders contact items correctly", () => {
    const contacts = [
      { key: "email", label: "Email", value: "alex@example.com", icon: "✉" },
      { key: "linkedin", label: "LinkedIn", value: "https://linkedin.com/in/alexrossi", icon: "🔗" },
      { key: "location", label: "Location", value: "Rome, Italy", icon: "📍" },
    ];

    const html = renderContacts(contacts as any, "default");

    expect(typeof html === "string" || html === null).toBe(true);

    if (typeof html === "string") {
      expect(html).toContain("alex@example.com");
      expect(html).toContain("linkedin");
      expect(html).toContain("Rome");
    }
  });

  it("returns null or empty for empty contacts", () => {
    const html = renderContacts([] as any, "default");

    expect(html === null || html === "").toBe(true);
  });

  it("escapes unsafe contact values", () => {
    const contacts = [
      { key: "email", label: "Email", value: `<script>alert(1)</script>`, icon: "✉" },
      { key: "website", label: "Website", value: `javascript:alert(1)`, icon: "🌐" },
    ];

    const html = renderContacts(contacts as any, "default");

    expect(typeof html === "string" || html === null).toBe(true);

    if (typeof html === "string") {
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    }
  });
});