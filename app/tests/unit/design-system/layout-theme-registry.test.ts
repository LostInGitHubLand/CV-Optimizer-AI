import { describe, expect, it } from "vitest";
import * as layoutRegistry from "../../../api/design-system/layouts/registry";
import * as themeRegistry from "../../../api/design-system/themes/registry";

function registryValues(moduleExports: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = moduleExports[key];
    if (value && typeof value === "object") {
      return Object.values(value as Record<string, unknown>);
    }
  }
  return [];
}

describe("layout and theme registries", () => {
  it("exposes only the three active layouts", () => {
    const layouts = registryValues(layoutRegistry as any, [
      "LAYOUTS",
      "LAYOUT_REGISTRY",
      "layouts",
    ]);

    const ids = layouts.map((layout: any) => layout.id ?? layout.layoutId);

    expect(ids).toEqual(
      expect.arrayContaining(["single-column", "sidebar-left", "sidebar-right"])
    );
    expect(ids).not.toContain("asymmetric-grid");
    expect(ids).not.toContain("asymmetric-sidebar");
  });

  it("exposes current themes and resolves concrete theme metadata", () => {
    const themes = registryValues(themeRegistry as any, [
      "THEMES",
      "THEME_REGISTRY",
      "themes",
    ]);

    expect(themes.length).toBeGreaterThan(0);

    const ids = themes.map((theme: any) => theme.id ?? theme.themeId);

    expect(ids).toContain("minimal-swiss");
    expect(ids).not.toContain("asymmetric-grid");
  });
});