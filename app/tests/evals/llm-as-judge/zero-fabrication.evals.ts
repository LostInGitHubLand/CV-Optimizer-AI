import { describe, expect, it } from "vitest";
import { baseJobAdvert, baseProfile } from "../../fixtures/profiles/base-profile";
import { judgeZeroFabricationWithQwen3 } from "./qwen3-judge";

function logJudge(result: any) {
  console.log("---- JUDGE RESULT ----");
  console.log(`Score: ${result.score}`);
  console.log(`Verdict: ${result.verdict}`);
  console.log(`Issues: ${result.issues.length}`);
  if (result.issues.length > 0) {
    console.log("Issues detail:", result.issues);
  } else {
    console.warn("⚠️ Judge returned empty issues array");
  }
  console.log("----------------------");
}

describe.skipIf(process.env.RUN_LLM_EVALS !== "true")(
  "qwen3 LLM-as-judge zero fabrication eval",
  () => {
    it(
      "fails output that invents metrics and upgrades finalist to winner",
      async () => {
        const result = await judgeZeroFabricationWithQwen3({
          sourceJsonProfile: baseProfile,
          jobAdvert: baseJobAdvert,
          analystStrategy: {},
          finalJsonCv: {
            name: "Alex Rossi",
            sections: [
              {
                type: "awards",
                entries: [
                  {
                    heading: "Winner — Regional Data Challenge 2021",
                    bullets: [],
                  },
                ],
              },
            ],
          },
          finalMarkdown: `# Alex Rossi

Winner — Regional Data Challenge 2021.
Built dashboards increasing reporting accuracy by 92%.
Led a team of 12 data analysts.`,
        });

        logJudge(result);

        expect(result.verdict).toBe("fail");
        expect(result.score).toBeLessThan(70);
      },
      300000
    );
  }
);