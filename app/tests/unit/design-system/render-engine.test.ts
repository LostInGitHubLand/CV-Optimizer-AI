import { describe, it, expect } from "vitest";
import { createDesignState, applyActions } from "../../../api/design-system/rendering/engine";
import { createMockLogger } from "../../helpers/mock-logger";

describe("rendering engine", () => {
  it("creates a design state from layout and theme", () => {
    const state = createDesignState("single-column" as any, "minimal-swiss" as any);

    expect(state.layoutId).toBe("single-column");
    expect(state.themeId).toBe("minimal-swiss");
    expect(state).toHaveProperty("colors");
    expect(state).toHaveProperty("typography");
  });

  it("applies actions without mutating the original state", () => {
    const state = createDesignState("single-column" as any, "minimal-swiss" as any);

    const next = applyActions(
      state,
      [
        { type: "set_layout", layoutId: "sidebar-left" },
        { type: "set_theme", themeId: "clean-startup" },
      ] as any,
      createMockLogger() as any
    );

    expect(next).not.toBe(state);
    expect(next.layoutId).toBe("sidebar-left");
    expect(next.themeId).toBe("clean-startup");
  });
});