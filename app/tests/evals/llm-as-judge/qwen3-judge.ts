import {
  JudgeResultSchema,
  buildZeroFabricationJudgePrompt,
  normalizeJudgeScore
} from "./zero-fabrication-rubric";
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const LLM_JUDGE_MODEL = process.env.LLM_JUDGE_MODEL ?? "qwen3";
export async function judgeZeroFabricationWithQwen3(input: { sourceJsonProfile: unknown; jobAdvert: string; analystStrategy: unknown; finalJsonCv: unknown; finalMarkdown: string; }) {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(300_000),
    body: JSON.stringify({
      model: LLM_JUDGE_MODEL,
      stream: false,
      keep_alive: 0, 
      options: {
        temperature: 0,
        num_ctx: 8192,
      },
      messages: [
        {
          role: "system",
          content: "You are a strict CV factual faithfulness evaluator. Return JSON only.",
        },
        {
          role: "user",
          content: buildZeroFabricationJudgePrompt(input),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama judge failed: ${response.status} ${response.statusText}`);
  const data = await response.json() as { message?: { content?: string }, response?: string };
  const raw = data.message?.content ?? data.response ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("qwen3 judge did not return JSON");
  const parsed = normalizeJudgeScore(JudgeResultSchema.parse(JSON.parse(jsonMatch[0])));

  if (parsed.verdict !== "pass" && parsed.issues.length === 0) {
  const retryResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(300_000),
    body: JSON.stringify({
      model: LLM_JUDGE_MODEL,
      stream: false,
      options: { temperature: 0, num_ctx: 8192 },
      messages: [
        {
          role: "system",
          content:
            "You are a strict CV factual faithfulness evaluator. Return JSON only.",
        },
        {
          role: "user",
          content: `${buildZeroFabricationJudgePrompt(input)}

Your previous answer returned verdict="${parsed.verdict}" and score=${parsed.score}, but issues was empty.

Return the SAME score and verdict, but populate issues with at least one concrete reason.
Each issue must quote the unsupported outputText from FINAL MARKDOWN or FINAL JSON CV.
Return STRICT JSON only.`,
        },
      ],
    }),
  });

  if (retryResponse.ok) {
    const retryData = (await retryResponse.json()) as {
      message?: { content?: string };
      response?: string;
    };

    const retryRaw = retryData.message?.content ?? retryData.response ?? "";
    const retryJsonMatch = retryRaw.match(/\{[\s\S]*\}/);

    if (retryJsonMatch) {
      const retryParsed = normalizeJudgeScore(
        JudgeResultSchema.parse(JSON.parse(retryJsonMatch[0]))
      );

      if (retryParsed.issues.length > 0) {
        return retryParsed;
      }
    }
  }
}

return parsed;
}
