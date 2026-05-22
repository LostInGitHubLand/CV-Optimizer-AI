import { describe, expect, it } from "vitest";
import { createDesignState, applyActions } from "../../../api/design-system/rendering/engine";
import { createMockLogger } from "../../helpers/mock-logger";

describe("rendering engine actions", () => {
  it("handles density actions without crashing", () => {

    const state = createDesignState("single-column" as any, "minimal-swiss" as any);
    const next = applyActions(
        state,
        [{ type: "set_density", density: "compact" }] as any,
        createMockLogger() as any
    );

  expect(next).toBeTruthy();
  expect(next.layoutId).toBe("single-column");
  expect(next.themeId).toBe("minimal-swiss");
});

  it("ignores unknown actions without crashing", () => {
    const state = createDesignState("single-column" as any, "minimal-swiss" as any);

    const next = applyActions(
      state,
      [{ type: "unknown_action", value: "x" }] as any,
      createMockLogger() as any
    );

    expect(next).toBeTruthy();
    expect(next.layoutId).toBe("single-column");
  });

  it("handles density actions without crashing", () => {
    const state = createDesignState("single-column" as any, "minimal-swiss" as any);
    const next = applyActions(
        state,
        [{ type: "set_density", density: "compact" }] as any,
        createMockLogger() as any);

  expect(next).toBeTruthy();
  expect(next.layoutId).toBe("single-column");
  expect(next.themeId).toBe("minimal-swiss");
});
});