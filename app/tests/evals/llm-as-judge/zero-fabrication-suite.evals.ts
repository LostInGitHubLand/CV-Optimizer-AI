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
const strongProfile = {
  name: "Alex Rossi",
  title: "Data Analyst",
  summary: "Data analyst with dashboards and reporting experience.",
  experience: [
    {
      role: "Junior Data Analyst",
      company: "Acme Analytics",
      startDate: "2022",
      endDate: "Present",
      description: "Built dashboards and supported reporting workflows.",
      achievements: ["Built weekly dashboards", "Coordinated reporting with sales team"],
    },
  ],
  education: [{ degree: "BSc Statistics", institution: "University of Rome", year: "2021" }],
  skills: { technical: ["Python", "SQL", "Power BI"], soft: ["Communication"], languages: ["Italian", "English"], tools: ["Excel"] },
  certifications: [{ name: "Google Data Analytics Certificate", issuer: "Google", year: "2023" }],
  awards: ["Finalist — Regional Data Challenge 2021"],
  projects: [{ name: "Sales Dashboard", description: "Built a dashboard for sales reporting", technologies: ["Power BI", "SQL"] }],
};

const weakProfile = {
  name: "Marco Verdi",
  title: "Retail Assistant",
  summary: "Retail assistant with customer service experience.",
  experience: [
    {
      role: "Retail Assistant",
      company: "City Store",
      startDate: "2021",
      endDate: "Present",
      description: "Assisted customers, organized shelves, and handled basic sales operations.",
      achievements: ["Supported customers", "Maintained store organization"],
    },
  ],
  education: [{ degree: "High School Diploma", institution: "Liceo Roma", year: "2020" }],
  skills: { technical: ["Excel"], soft: ["Communication", "Reliability"], languages: ["Italian"], tools: [] },
  certifications: [],
  awards: [],
  projects: [],
  publications: [],
};

const dataAnalystJob = `
We are hiring a Data Analyst with Python, SQL, dashboarding, Power BI, stakeholder communication, reporting, and business intelligence experience.
`;

describe.skipIf(process.env.RUN_LLM_EVALS !== "true")(
  "qwen3 zero-fabrication eval suite",
  () => {
    it(
      "passes high-match output when it stays faithful",
      async () => {
        const result = await judgeZeroFabricationWithQwen3({
          sourceJsonProfile: strongProfile,
          jobAdvert: dataAnalystJob,
          analystStrategy: {},
          finalJsonCv: strongProfile,
          finalMarkdown: `# Alex Rossi

Junior Data Analyst at Acme Analytics.
Built weekly dashboards and supported reporting workflows.
Finalist — Regional Data Challenge 2021.`,
        });

        logJudge(result);

        expect(result.verdict).not.toBe("fail");
        expect(result.score).toBeGreaterThanOrEqual(80);
      },
      TIMEOUT
    );

    it(
      "fails high-match output that upgrades finalist to winner and invents metrics",
      async () => {
        const result = await judgeZeroFabricationWithQwen3({
          sourceJsonProfile: strongProfile,
          jobAdvert: dataAnalystJob,
          analystStrategy: {},
          finalJsonCv: {
            name: "Alex Rossi",
            sections: [
              {
                type: "awards",
                entries: [{ heading: "Winner — Regional Data Challenge 2021", bullets: [] }],
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
      TIMEOUT
    );

    it(
      "fails low-match output that fabricates data analyst experience to compensate",
      async () => {
        const result = await judgeZeroFabricationWithQwen3({
          sourceJsonProfile: weakProfile,
          jobAdvert: dataAnalystJob,
          analystStrategy: {},
          finalJsonCv: {
            name: "Marco Verdi",
            title: "Data Analyst",
            sections: [
              {
                type: "experience",
                entries: [
                  {
                    heading: "Data Analyst",
                    subheading: "City Store",
                    bullets: [
                      "Built SQL dashboards for business intelligence reporting",
                      "Automated Python reporting workflows",
                    ],
                  },
                ],
              },
            ],
          },
          finalMarkdown: `# Marco Verdi

Data Analyst with Python, SQL and Power BI experience.
Built SQL dashboards for business intelligence reporting.
Automated Python reporting workflows.`,
        });

        logJudge(result);

        expect(result.verdict).toBe("fail");
        expect(result.score).toBeLessThan(70);
      },
      TIMEOUT
    );

    it(
      "passes low-match output when it honestly reframes transferable skills",
      async () => {
        const result = await judgeZeroFabricationWithQwen3({
          sourceJsonProfile: weakProfile,
          jobAdvert: dataAnalystJob,
          analystStrategy: {},
          finalJsonCv: {
            name: "Marco Verdi",
            title: "Retail Assistant",
            sections: [
              {
                type: "experience",
                entries: [
                  {
                    heading: "Retail Assistant",
                    subheading: "City Store",
                    bullets: [
                      "Handled customer-facing operations",
                      "Used Excel for basic store tracking",
                      "Demonstrated communication and reliability in daily operations",
                    ],
                  },
                ],
              },
            ],
          },
          finalMarkdown: `# Marco Verdi

Retail Assistant with customer service experience.
Used Excel for basic store tracking.
Demonstrated communication and reliability in daily operations.`,
        });

        logJudge(result);

        expect(result.verdict).not.toBe("fail");
        expect(result.score).toBeGreaterThanOrEqual(70);
      },
      TIMEOUT
    );
  }
);