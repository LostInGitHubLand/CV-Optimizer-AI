/**
 * Pipeline Metrics — timing, tokens, refinement sessions per job
 */

import { logger } from "../infrastructure/logging/logger";

interface AgentMetrics {
  agent: string;
  state: "main" | "refine";
  durationMs: number;
  promptTokens: number;
  genTokens: number;
}

const pipelineMetrics = new Map<number, {
  agents: AgentMetrics[];
  refineSessions: number;
}>();

export function recordAgentStart(jobId: number): () => void {
  const t0 = Date.now();
  return (agent: string, state: "main" | "refine") => {
    const duration = Date.now() - t0;
    recordAgentTiming(jobId, agent, state, duration);
  };
}

/** Push a timing entry directly into the shared metrics map.
 *  If a placeholder entry (durationMs: 0) already exists from an earlier
 *  token callback, the timing is merged into the placeholder instead of
 *  creating a duplicate entry. */
export function recordAgentTiming(
  jobId: number,
  agent: string,
  state: "main" | "refine",
  durationMs: number
) {
  const entry = pipelineMetrics.get(jobId);
  if (!entry) return;
  // Check for a placeholder created by a prior token callback (durationMs === 0)
  const placeholder = entry.agents.find(
    (a) => a.agent === agent && a.state === state && a.durationMs === 0
  );
  if (placeholder) {
    placeholder.durationMs = durationMs;
  } else {
    entry.agents.push({ agent, state, durationMs, promptTokens: 0, genTokens: 0 });
  }
}

export function recordTokens(
  jobId: number,
  agent: string,
  state: "main" | "refine",
  promptTokens: number,
  genTokens: number
) {
  const entry = pipelineMetrics.get(jobId);
  if (!entry) return;
  for (let i = entry.agents.length - 1; i >= 0; i--) {
    if (entry.agents[i].agent === agent && entry.agents[i].state === state) {
      entry.agents[i].promptTokens += promptTokens;
      entry.agents[i].genTokens += genTokens;
      return;
    }
  }
  entry.agents.push({ agent, state, durationMs: 0, promptTokens, genTokens });
}

export function recordRefineSession(jobId: number) {
  const entry = pipelineMetrics.get(jobId);
  if (entry) entry.refineSessions++;
}

export function initMetrics(jobId: number) {
  pipelineMetrics.set(jobId, { agents: [], refineSessions: 0 });
}

export function printPipelineReport(jobId: number, log: ReturnType<typeof logger>) {
  const m = pipelineMetrics.get(jobId);
  if (!m) return;

  const byAgent = new Map<string, {
    mainMs: number; refineMs: number;
    mainPrompt: number; mainGen: number;
    refinePrompt: number; refineGen: number;
  }>();

  for (const a of m.agents) {
    let e = byAgent.get(a.agent);
    if (!e) e = { mainMs: 0, refineMs: 0, mainPrompt: 0, mainGen: 0, refinePrompt: 0, refineGen: 0 };
    if (a.state === "main") {
      e.mainMs += a.durationMs;
      e.mainPrompt += a.promptTokens;
      e.mainGen += a.genTokens;
    } else {
      e.refineMs += a.durationMs;
      e.refinePrompt += a.promptTokens;
      e.refineGen += a.genTokens;
    }
    byAgent.set(a.agent, e);
  }

  let grandMs = 0, grandPrompt = 0, grandGen = 0;

  console.log(`\n` + `=`.repeat(72));
  console.log(`  PIPELINE COMPLETION REPORT — Job ${jobId}`);
  console.log(`=`.repeat(72));
  console.log(`  Agent           | Main (sec) | Refine (sec) | Total (sec) | PromptTok | GenTok`);
  console.log(`  ${`-`.repeat(70)}`);

  for (const [agent, d] of byAgent) {
    const mainSec = (d.mainMs / 1000).toFixed(1);
    const refineSec = (d.refineMs / 1000).toFixed(1);
    const totalSec = ((d.mainMs + d.refineMs) / 1000).toFixed(1);
    const totPT = d.mainPrompt + d.refinePrompt;
    const totGT = d.mainGen + d.refineGen;
    grandMs += d.mainMs + d.refineMs;
    grandPrompt += totPT; grandGen += totGT;
    console.log(
      `  ${agent.padEnd(15)} | ${mainSec.padStart(10)} | ${refineSec.padStart(12)} | ${totalSec.padStart(11)} | ${String(totPT).padStart(9)} | ${String(totGT).padStart(6)}`
    );
  }

  console.log(`  ${`-`.repeat(70)}`);
  const grandTotalSec = (grandMs / 1000).toFixed(1);
  const grandAll = grandPrompt + grandGen;
  console.log(`  ${`TOTAL`.padEnd(15)} |            |              | ${grandTotalSec.padStart(11)} | ${String(grandPrompt).padStart(9)} | ${String(grandGen).padStart(6)}`);
  console.log(`  Total tokens (Prompt + Generated): ${grandAll}`);
  console.log(`  Refinement sessions: ${m.refineSessions}`);
  console.log(`=`.repeat(72) + `\n`);

  pipelineMetrics.delete(jobId);
}
