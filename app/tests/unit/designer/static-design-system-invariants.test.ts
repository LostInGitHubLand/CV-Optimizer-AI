import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

describe("Design system invariants", () => {
  it("does not reference removed asymmetric-grid layout in active code", () => {
    const filesToCheck = [
      // backend semantic + rendering
      "app/api/design-system/layouts/registry.ts",
      "app/api/design-system/semantic/schema.ts",
      "app/api/design-system/rendering/base-styles.ts",

      // frontend UI (tips, docs shown to users)
      "src/components/RefinementPanel.tsx",
      "src/pages/HowItWorks.tsx",
      "src/pages/GitHubDocs.tsx",
    ];

    const offenders: string[] = [];

    for (const file of filesToCheck) {
      const fullPath = path.resolve(file);
      const content = readFileSafe(fullPath).toLowerCase();

      if (
        content.includes("asymmetric-grid") ||
        content.includes("asymmetric-sidebar")
      ) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps only the three valid layout ids in the public contract", () => {
    const validLayouts = ["single-column", "sidebar-left", "sidebar-right"];

    expect(validLayouts).toHaveLength(3);
    expect(validLayouts).not.toContain("asymmetric-grid");
    expect(validLayouts).not.toContain("asymmetric-sidebar");
  });
});