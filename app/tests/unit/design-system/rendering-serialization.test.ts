import { describe, expect, it } from "vitest";
import { deserializeDesignState, serializeDesignState } from "../../../api/design-system/rendering/serialize";

describe("DesignState serialization", () => {
  it("round-trips a design state object", () => {
    const state = {
      layoutId: "sidebar-left",
      themeId: "minimal-swiss",
      primary: "#111827",
      font: "Inter, Arial, sans-serif",
      spacing: "spacious",
      theme: { id: "minimal-swiss" },
      layout: { id: "sidebar-left" },
    } as any;

    const serialized = serializeDesignState(state);
    const restored = deserializeDesignState(serialized);

    expect(restored).toMatchObject({ layoutId: "sidebar-left", themeId: "minimal-swiss" });
  });

  it("falls back safely on invalid design state input", () => {
    expect(deserializeDesignState(null as any)).toMatchObject({
      layoutId: "single-column",
      themeId: "minimal-swiss",
    });

    expect(deserializeDesignState(undefined as any)).toMatchObject({
      layoutId: "single-column",
      themeId: "minimal-swiss",
    });

    expect(deserializeDesignState("not-json" as any)).toMatchObject({
      layoutId: "single-column",
      themeId: "minimal-swiss",
    });
  });
});
