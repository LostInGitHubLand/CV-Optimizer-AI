import { describe, expect, it } from "vitest";
import { DEFAULT_SEMANTIC_STATE } from "../../../api/design-system/semantic/state";
import {
  createDefaultComposition,
  deserializeDesignComposition,
  inferInitialComposition,
  serializeDesignComposition,
} from "../../../api/design-system/composition";
import { resolveDesignState } from "../../../api/design-system/semantic/resolution";
import { createMockLogger } from "../../helpers/mock-logger";

describe("semantic state defaults", () => {
  it("contains stable defaults for tone and density", () => {
    expect(DEFAULT_SEMANTIC_STATE).toMatchObject({
      tone: expect.any(String),
      density: expect.any(String),
    });

    expect(Object.keys(DEFAULT_SEMANTIC_STATE)).toEqual(
      expect.arrayContaining(["tone", "density"])
    );
  });

  it("can be cloned and modified without mutating the default object", () => {
    const clone = { ...DEFAULT_SEMANTIC_STATE, tone: "modern" };

    expect(clone.tone).toBe("modern");
    expect(DEFAULT_SEMANTIC_STATE).not.toBe(clone);
  });

  it("resolves a complete composition with overridden semantic state", () => {
    const composition = {
      layoutId: "single-column",
      themeId: "minimal-swiss",
      semanticState: {
        ...DEFAULT_SEMANTIC_STATE,
        tone: "corporate",
      },
      sectionLayout: {
        main: ["summary", "experience"],
        sidebar: [],
      },
      sectionVariants: {},
      sectionDataOverrides: {},
      renderingOverrides: {},
    };

    const log = createMockLogger();

    const state = resolveDesignState(composition as any, log as any);

    expect(state.layoutId).toBe("single-column");
    expect(state.themeId).toBe("minimal-swiss");
  });
});