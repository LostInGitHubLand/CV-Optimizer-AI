import { describe, expect, it } from "vitest";

describe("Semantic refine flow contract", () => {
  it("skills expertise-bars keeps layout unchanged and defaults missing levels to 100", () => {
    const composition: any = { layoutId: "sidebar-left", themeId: "technical-dark", sectionVariants: {}, sectionDataOverrides: { skills: { levels: {} } } };
    const actions = [
      { type: "set_section_variant", section: "skills", variant: "expertise-bars" },
      { type: "set_all_skill_levels", level: 100 },
      { type: "set_skill_level", skill: "Python", level: 70 },
      { type: "set_skill_level", skill: "Java", level: 90 },
    ];
    for (const action of actions as any[]) {
      if (action.type === "set_section_variant") composition.sectionVariants[action.section] = action.variant;
      if (action.type === "set_all_skill_levels") composition.sectionDataOverrides.skills.levels._default = action.level;
      if (action.type === "set_skill_level") composition.sectionDataOverrides.skills.levels[action.skill] = action.level;
    }
    expect(composition.layoutId).toBe("sidebar-left");
    expect(composition.sectionVariants.skills).toBe("expertise-bars");
    expect(composition.sectionDataOverrides.skills.levels._default).toBe(100);
    expect(composition.sectionDataOverrides.skills.levels.Python).toBe(70);
    expect(composition.sectionDataOverrides.skills.levels.Java).toBe(90);
  });
});
