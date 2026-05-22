import { describe, expect, it } from "vitest";
import { judgeZeroFabricationWithQwen3 } from "./qwen3-judge";

const TIMEOUT = 300_000;

function logJudge(result: any) {
  console.log("---- JUDGE RESULT ----");
  console.log(`Score: ${result.score}`);
  console.log(`Verdict: ${result.verdict}`);
  console.log(`Issues: ${result.issues.length}`);

  if (result.issues.length > 0) {
    console.log("Issues detail:", result.issues);
  } else if (result.verdict !== "pass") {
    console.warn("⚠️ Judge returned empty issues array on fail/warn");
  }

  console.log("----------------------");
}

const sourceProfile = {
  name: "Marco Verdi",
  title: "Retail Assistant",
  summary: "Retail assistant with customer service experience.",
  experience: [],
  education: [
    {
      degree: "BSc Economics",
      institution: "University of Rome",
      field: "Economics",
      startDate: "2017",
      year: "2021",
      grade: "",
      details: "",
    },
  ],
  skills: {
    technical: ["Excel"],
    soft: ["Communication", "Reliability"],
    languages: ["Italian"],
    tools: [],
  },
  certifications: [],
  projects: [],
  awards: [],
  publications: [],
  volunteer: [],
  interests: [],
};

const jobAdvert = `
We are hiring a highly selective Investment Analyst.
Ideal candidates have top academic performance, honors, distinction, strong quantitative credentials and excellent grades.
`;

describe.skipIf(process.env.RUN_LLM_EVALS !== "true")(
  "qwen3 LLM-as-judge education grade fabrication eval",
  () => {
    it(
      "fails output that invents a missing university grade and honors",
      async () => {
        const result = await judgeZeroFabricationWithQwen3({
          sourceJsonProfile: sourceProfile,
          jobAdvert,
          analystStrategy: {},
          finalJsonCv: {
            name: "Marco Verdi",
            title: "Investment Analyst",
            sections: [
              {
                type: "education",
                title: "Education",
                entries: [
                  {
                    heading: "BSc Economics",
                    subheading: "University of Rome",
                    date: "2017 – 2021",
                    bullets: ["Grade: 110/110 cum laude"],
                  },
                ],
              },
            ],
          },
          finalMarkdown: `# Marco Verdi

## Education

BSc Economics — University of Rome, 2017 – 2021.
Grade: 110/110 cum laude.`,
        });

        logJudge(result);

        expect(result.verdict).toBe("fail");
        expect(result.score).toBeLessThan(70);
      },
      TIMEOUT
    );
  }
);