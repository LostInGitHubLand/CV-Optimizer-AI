/**
 * Pipeline Core — 4-stage agent execution with resilience
 *   Fetcher → Analyst → Writer → Designer
 *
 * This module coordinates agent execution ONLY.
 * All persistence flows through the application service layer:
 *   - JobService (data writes, status transitions)
 *   - ProgressService (real-time progress publishing)
 *
 * NO direct database access in this file.
 * NO template selection. NO template fallback.
 */

import { extractTextFromPdf } from "../infrastructure/pdf";
import { unloadAllModels } from "../infrastructure/ai/ollama";
import { logger, startTimer } from "../infrastructure/logging/logger";
import { assertJobNotLocked, cleanupProgressMap, withTimeout } from "../infrastructure/concurrency/job-lock";
import { runFetcher, runFetcherOnPdf, fallbackExtraction } from "../agents/fetcher";
import { runAnalyst, runRuleBasedAnalysis } from "../agents/analyst";
import { runWriter } from "../agents/writer";
import { runDesignerMain } from "../agents/designer";
import { serializeDesignState } from "../design-system/rendering/serialize";
import type { DesignComposition } from "../design-system/composition";
import type { DesignState } from "../design-system/rendering/types";
import { JobStatus } from "../domain/workflow/job-status";
import { updateJob, saveRawText, findJobById } from "../repositories/cv-job-repository";
import { agentStarted, publishProgress, pipelineComplete, markError } from "../application/services/progress-service";
import { initMetrics, recordAgentTiming, recordTokens } from "./metrics";

const PIPELINE_TIMEOUT_MS = 540_000;

/** Public entry: run pipeline with timeout, locking, and cleanup */
export async function runPipelineWithResilience(
  jobId: number,
  domain: string,
  parentLog: ReturnType<typeof logger>
): Promise<void> {
  const log = parentLog.child({ sessionId: `p_${Date.now()}` });
  const startTime = Date.now();

  try {
    await withTimeout(
      runPipelineCore(jobId, domain, log),
      PIPELINE_TIMEOUT_MS,
      `Pipeline job ${jobId}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("PIPELINE", `CRITICAL: ${msg}`);
    await markError(jobId, msg, log);
  } finally {
    const duration = Date.now() - startTime;
    log.info("PIPELINE", `Finished in ${duration}ms. Cleaning up VRAM + progressMap.`);
    try { await unloadAllModels(); } catch (e) { log.warn("VRAM", `Unload failed: ${e}`); }
    cleanupProgressMap(new Map(), jobId, jobId);
  }
}

/** Internal: 4-stage pipeline */
async function runPipelineCore(
  jobId: number,
  domain: string,
  log: ReturnType<typeof logger>
): Promise<void> {
  initMetrics(jobId);

  const job = await findJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found at pipeline start`);
  const jobAdvert = job.jobAdvert || "";
  log.info(
    "PIPELINE",
    `Job updates loaded | length: ${(job.updates ?? "").length} | preview: ${(job.updates ?? "").slice(0, 120)}`
  );
  /* ── STAGE 1: FETCHER ── */
  log.info("FETCHER", "Starting extraction...");
  await agentStarted(jobId, JobStatus.Fetching, "FETCHER", "Extracting structured data...", log);

  let profile: Record<string, unknown>;
  let fetcherOutput: string;
  const fetcherT0 = Date.now();

  try {
    const timer = startTimer("FETCHER");
    if (job.inputType === "url" && job.sourceUrl) {
      const result = await runFetcher(job.sourceUrl, job.updates ?? undefined, log, (p, g) => recordTokens(jobId, "FETCHER", "main", p, g), domain);
      profile = result.jsonProfile as Record<string, unknown>;
      fetcherOutput = JSON.stringify(result.jsonProfile);
      log.info("FETCHER", "URL scrape complete", timer);
    } else {
      let rawText = job.rawText || "";
      if (!rawText && job.pdfPath) {
        log.info("FETCHER", "Extracting text from PDF...");
        rawText = await extractTextFromPdf(job.pdfPath);
        await saveRawText(jobId, rawText);
      }
      const result = await runFetcherOnPdf(
        rawText,
        job.updates ?? undefined,
        log,
        (p, g) => recordTokens(jobId, "FETCHER", "main", p, g),
        domain
      );
      profile = result.jsonProfile as Record<string, unknown>;
      fetcherOutput = JSON.stringify(result.jsonProfile);
      log.info("FETCHER", "PDF extraction complete", timer);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("FETCHER", `AI failed: ${msg}. Fallback active.`, startTimer("FETCHER"));
    const fb = fallbackExtraction(job.rawText || "", null, log, domain);
    profile = fb.jsonProfile as Record<string, unknown>;
    fetcherOutput = JSON.stringify(fb.jsonProfile);
    log.info("FETCHER", "Fallback extraction applied");
  }
  recordAgentTiming(jobId, "FETCHER", "main", Date.now() - fetcherT0);

  await updateJob(jobId, { jsonProfile: profile, fetcherOutput });

  /* ── STAGE 2: ANALYST ── */
  log.info("ANALYST", "Starting analysis...");
  await agentStarted(jobId, JobStatus.Analyzing, "ANALYST", "Analyzing against job requirements...", log);

  let strategy: Record<string, unknown>;
  let analystOutput: string;
  const analystT0 = Date.now();

  try {
    const timer = startTimer("ANALYST");
    const analystResult = await runAnalyst(jobAdvert, profile, domain, log, (p, g) => recordTokens(jobId, "ANALYST", "main", p, g));
    strategy = analystResult.jsonStrategy;
    analystOutput = JSON.stringify(analystResult.jsonStrategy);
    log.info("ANALYST", "AI analysis complete", timer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("ANALYST", `AI failed: ${msg}. Rule-based fallback active.`, startTimer("ANALYST"));
    const fb = runRuleBasedAnalysis(jobAdvert, profile, domain, log);
    strategy = fb.jsonStrategy;
    analystOutput = JSON.stringify(fb.jsonStrategy);
    log.info("ANALYST", "Rule-based fallback applied");
  }
  recordAgentTiming(jobId, "ANALYST", "main", Date.now() - analystT0);

  await updateJob(jobId, { jsonStrategy: strategy, analystOutput });
  // Strategy data — parse once, reuse across all phases
  const strategyDataObj = JSON.parse(analystOutput) as Record<string, unknown>;
  await publishProgress(jobId, JobStatus.Analyzing, "ANALYST", "Strategy complete", {
    strategyData: strategyDataObj,
  }, log);

  /* ── STAGE 3: WRITER ── */
  log.info("WRITER", "Starting content generation...");
  await agentStarted(jobId, JobStatus.Writing, "WRITER", "Generating optimized CV content...", log);

  let writerResult: { markdown: string; jsonCv: Record<string, unknown>; title: string };
  const writerT0 = Date.now();

  try {
    const timer = startTimer("WRITER");
    const result = await runWriter({ profile, strategy, jobAdvert, mode: "main" }, log, (p, g) => recordTokens(jobId, "WRITER", "main", p, g));
    writerResult = result;
    log.info("WRITER", "AI content generation complete", timer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("WRITER", `AI failed: ${msg}. Retrying.`, startTimer("WRITER"));
    const result = await runWriter({ profile, strategy, jobAdvert, mode: "main" }, log, (p, g) => recordTokens(jobId, "WRITER", "main", p, g));
    writerResult = result;
    log.info("WRITER", "Retry applied");
  }
  recordAgentTiming(jobId, "WRITER", "main", Date.now() - writerT0);

  await updateJob(jobId, {
    jsonCv: writerResult.jsonCv,
    markdownOutput: writerResult.markdown,
    writerOutput: JSON.stringify(writerResult),
  });

  /* ── STAGE 4: DESIGNER ── */
  log.info("DESIGNER", "Starting layout generation...");
  await agentStarted(jobId, JobStatus.Designing, "DESIGNER", "Applying composition + generating PDF...", log);

  let designerResult: { html: string; pdfPath: string; designComposition: DesignComposition; designState?: DesignState };
  const designerT0 = Date.now();

  try {
    const timer = startTimer("DESIGNER");
    const result = await runDesignerMain({
      jsonCv: writerResult.jsonCv,
      jobTitle: (writerResult.jsonCv as Record<string, string>).title ?? "",
      domain,
    }, log, (p, g) => recordTokens(jobId, "DESIGNER", "main", p, g));
    designerResult = {
      html: result.html,
      pdfPath: result.pdfPath,
      designComposition: result.designComposition,
      designState: result.designState,
    };
    log.info("REFINE_RESULT", `Composition: layout="${designerResult.designComposition.layoutId}" theme="${designerResult.designComposition.themeId}"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("DESIGNER", `AI failed: ${msg}. Composition fallback.`, startTimer("DESIGNER"));
    // Composition fallback — NO template logic
    const { inferInitialComposition } = await import("../design-system/composition");
    const { resolveDesignState } = await import("../design-system/semantic/resolution");
    const { renderSemanticHtml } = await import("../design-system/renderer");
    const { sanitizeCvHtml } = await import("../infrastructure/security");
    const { convertHtmlToPdf } = await import("../infrastructure/pdf");
    const { designStateToCssVariables } = await import("../design-system/rendering/css-vars");
    const { getBaseStyles } = await import("../design-system/rendering/base-styles");

    const fallbackComposition = inferInitialComposition(writerResult.jsonCv as Record<string, unknown>, domain, log);
    const fallbackDesignState = resolveDesignState(fallbackComposition, log);
    let html = renderSemanticHtml(writerResult.jsonCv as Record<string, unknown>, fallbackComposition, fallbackDesignState);
    const cssVars = designStateToCssVariables(fallbackDesignState);
    html = html.replace("<head>", `<head><style>${cssVars}${getBaseStyles()}</style>`);
    html = sanitizeCvHtml(html);
    const pdfPath = `/tmp/${jobId}_fallback_${Date.now()}.pdf`;
    await convertHtmlToPdf(html, pdfPath, fallbackDesignState.layoutId);
    designerResult = {
      html,
      pdfPath,
      designComposition: fallbackComposition,
      designState: fallbackDesignState,
    };
    log.info("SAVING_COMPOSITION", `layout="${designerResult.designComposition.layoutId}" theme="${designerResult.designComposition.themeId}"`);
  }
  recordAgentTiming(jobId, "DESIGNER", "main", Date.now() - designerT0);
  log.info("SAVING_COMPOSITION", `layout="${designerResult.designComposition.layoutId}" theme="${designerResult.designComposition.themeId}"`);

  await updateJob(jobId, {
    htmlOutput: designerResult.html,
    pdfPathOutput: designerResult.pdfPath,
    designComposition: designerResult.designComposition,
    designState: designerResult.designState ?? null,
  });

  await pipelineComplete(
    jobId,
    designerResult.designState
      ? serializeDesignState(designerResult.designState)
      : undefined,
    log
  );

  log.info("PIPELINE", "All 4 stages complete. Awaiting user review.");
}
