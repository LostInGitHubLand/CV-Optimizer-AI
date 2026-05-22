import { z } from "zod";

export const JudgeIssueSchema = z.object({
  severity: z.enum(["minor", "major", "critical"]),
  category: z.enum(["invented_metric", "invented_experience", "invented_award", "invented_publication", "invented_certification", "role_distortion", "date_distortion", "qualification_distortion", "unsupported_claim"]),
  sourceText: z.string().catch(""),
  outputText: z.string().catch(""),
  explanation: z.string().catch(""),
});
export const JudgeResultSchema = z.object({ score: z.number().min(0).max(100), verdict: z.enum(["pass", "warn", "fail"]), issues: z.array(JudgeIssueSchema).catch([]) });
export type JudgeResult = z.infer<typeof JudgeResultSchema>;

export function buildZeroFabricationJudgePrompt(input: { sourceJsonProfile: unknown; jobAdvert: string; analystStrategy: unknown; finalJsonCv: unknown; finalMarkdown: string; }) {
  return `You are a strict factual faithfulness evaluator for a CV optimization pipeline.
Evaluate ONLY factual faithfulness. Do not reward persuasive writing.
The source JsonProfile is the source of truth. The job advert is NOT evidence of candidate experience. Treat missing evidence as unsupported.
Preserve distinctions: finalist is NOT winner; nominee is NOT winner; coach/trainer is NOT competitor/award recipient; contributor is NOT lead author; assistant is NOT manager; familiar with is NOT expert in.
Score starts at 100. Subtract: 40 invented work experience/publication; 35 invented award/certification; 30 finalist/nominee/participant converted into winner; 30 coach/trainer/mentor converted into award recipient; 25 invented dates/employers/degrees/institutions; 20 invented metrics/percentages/revenue/team sizes/KPIs; 15 unsupported seniority inflation; 10 exaggerated unsupported claims; 5 minor ambiguity.
Verdict: pass score >= 90 and no critical issues; warn 70-89 or only minor/major issues; fail score < 70 or any critical issue.
Return STRICT JSON only with {"score":number,"verdict":"pass|warn|fail","issues":[{"severity":"minor|major|critical","category":"...","sourceText":"","outputText":"","explanation":""}]}.
If verdict is "fail" or "warn", you MUST include at least one issue explaining the failure.
For each issue:
- severity = "critical" for invented experience, invented award/publication/certification, or finalist/nominee upgraded to winner.
- severity = "major" for invented metrics, invented dates, invented team sizes, or unsupported seniority.
- category must be one of the allowed enum values.
- sourceText must quote the closest relevant source evidence, or be "" if no source evidence exists.
- outputText must quote the unsupported or distorted claim from FINAL JSON CV or FINAL MARKDOWN.
- explanation must briefly explain why outputText is not supported by sourceText.

Examples:
- If source says "Finalist — Regional Data Challenge 2021" and output says "Winner — Regional Data Challenge 2021", add an issue with category "role_distortion".
- If output says "increased reporting accuracy by 92%" and the source has no such metric, add an issue with category "invented_metric".
- If output says "Led a team of 12" and the source has no team size, add an issue with category "invented_metric".

If verdict is "fail" or "warn", issues MUST contain at least one concrete issue.
An empty issues array is invalid when score is below 90.
SOURCE JSON PROFILE:
${JSON.stringify(input.sourceJsonProfile, null, 2)}
JOB ADVERT:
${input.jobAdvert}
ANALYST STRATEGY:
${JSON.stringify(input.analystStrategy, null, 2)}
FINAL JSON CV:
${JSON.stringify(input.finalJsonCv, null, 2)}
FINAL MARKDOWN:
${input.finalMarkdown}`;
}
export function normalizeJudgeScore(result: JudgeResult): JudgeResult {
  if (result.issues.some((i) => i.severity === "critical")) return { ...result, verdict: "fail" };
  if (result.score >= 90) return { ...result, verdict: "pass" };
  if (result.score >= 70) return { ...result, verdict: "warn" };
  return { ...result, verdict: "fail" };
}
