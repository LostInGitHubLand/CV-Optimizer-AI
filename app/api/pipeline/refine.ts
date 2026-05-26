/**
 * Pipeline Refinement — Writer + Designer re-execution with resilience
 *
 * This module coordinates agent execution ONLY.
 * All persistence flows through the application service layer.
 * NO direct database access in this file.
 * NO template selection. NO domain-based inference during refine.
 */

import { convertHtmlToPdf } from "../infrastructure/pdf";
import { sanitizeCvHtml } from "../infrastructure/security";
import { unloadAllModels } from "../infrastructure/ai/ollama";
import { logger, startTimer } from "../infrastructure/logging/logger";
import { assertJobNotLocked } from "../infrastructure/concurrency/job-lock";
import { runWriter } from "../agents/writer";
import { runDesignerRefine } from "../agents/designer";
import { renderSemanticHtml } from "../design-system/renderer";
import { resolveDesignState } from "../design-system/semantic/resolution";
import { serializeDesignState } from "../design-system/rendering/serialize";
import { createDefaultComposition } from "../design-system/composition";
import type { DesignComposition } from "../design-system/composition";
import type { DesignState } from "../design-system/rendering/types";
import type { JsonCv } from "../agents/writer";
import { JobStatus } from "../domain/workflow/job-status";
import { updateJob, findJobById } from "../repositories/cv-job-repository";
import { publishProgress, refinementComplete, markError } from "../application/services/progress-service";
import { recordTokens, recordAgentTiming, recordRefineSession } from "./metrics";

export async function runRefinementWithResilience(
  jobId: number,
  jsonCv: Record<string, unknown>,
  markdown: string,
  writerInstruction: string,
  designerInstruction: string,
  jobAdvert: string,
  currentDesignComposition: DesignComposition | undefined,
  parentLog: ReturnType<typeof logger>,
  markdownEdited = false
): Promise<void> {
  const log = parentLog.child({ sessionId: `r_${Date.now()}` });
  recordRefineSession(jobId);

  // Ensure a valid composition exists. If none was provided (e.g. job hasn't
  // run the main pipeline yet), create a default. The serializer guarantees
  // a valid object, but this is a defensive fallback.
  if (!currentDesignComposition) {
    log.warn("REFINE", `Job ${jobId}: No DesignComposition provided — creating default.`);
    currentDesignComposition = createDefaultComposition();
  }

  try {
    /* ── Writer Refine ── */
    await publishProgress(
      jobId,
      JobStatus.Refining,
      "WRITER_REFINE",
      "Applying writer refinements...",
      {},
      log
    );

    let refined: { markdown: string; jsonCv: Record<string, unknown>; title: string };
    const writerRefineT0 = Date.now();

    const writerLogMsg = writerInstruction.trim()
      ? `Applying: ${writerInstruction.slice(0, 60)}...`
      : "Syncing JsonCv from edited markdown (no instruction)";
    log.info("WRITER_REFINE", writerLogMsg);

    try {
      const timer = startTimer("WRITER_REFINE");
      const result = await runWriter({
        mode: "refine",
        currentJsonCv: jsonCv as Record<string, unknown>,
        currentMarkdown: markdown,
        instruction: writerInstruction,
        title: (jsonCv as Record<string, string>).name ?? (jsonCv as Record<string, string>).title ?? "",
        markdownEdited,
      }, log, (p, g) => recordTokens(jobId, "WRITER", "refine", p, g));
      
      refined = result;

      log.info(
        "WRITER_REFINE",
        `Sync/AI complete | markdownLength=${refined.markdown.length} | sections=${((refined.jsonCv as Record<string, unknown>).sections as Array<{ type: string; entries?: unknown[] }> | undefined)?.map((s) => `${s.type}:${s.entries?.length ?? 0}`).join(", ") ?? "none"}`,
        timer
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn("WRITER_REFINE", `AI failed: ${msg}. Using markdown as-is.`, startTimer("WRITER_REFINE"));
      refined = { markdown, jsonCv, title: (jsonCv as Record<string, string>).name ?? "" };
    }
    recordAgentTiming(jobId, "WRITER", "refine", Date.now() - writerRefineT0);

    /* ── Designer Refine ── */
    await publishProgress(
      jobId,
      JobStatus.Refining,
      "DESIGNER_REFINE",
      "Applying design refinements...",
      {},
      log
    );

    log.info("DESIGNER", "Re-rendering with current composition...");

    let finalResult: { html: string; pdfPath: string; designComposition: DesignComposition; designState?: DesignState };

    try {
      const designerRefineT0 = Date.now();
      const timer = startTimer("DESIGNER_REFINE");
      const result = await runDesignerRefine({
        jsonCv: refined.jsonCv,
        jobTitle: (refined.jsonCv as Record<string, string>).title ?? "",
        domain: (refined.jsonCv as Record<string, string>).domain ?? "",
        currentDesignComposition,
        instruction: designerInstruction,
      }, log, (p, g) => recordTokens(jobId, "DESIGNER", "refine", p, g));
      finalResult = {
        html: result.html,
        pdfPath: result.pdfPath,
        designComposition: result.designComposition,
        designState: result.designState,
      };
      log.info("REFINE_RESULT", `Composition: layout="${result.designComposition.layoutId}" theme="${result.designComposition.themeId}"`);
      recordAgentTiming(jobId, "DESIGNER", "refine", Date.now() - designerRefineT0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn("DESIGNER", `AI failed: ${msg}. Re-rendering with preserved composition.`, startTimer("DESIGNER_REFINE"));

      // Fallback: re-render with the SAME composition — NEVER infer from domain
      const designState = resolveDesignState(currentDesignComposition, log);
      log.info(
        "DESIGNER_FALLBACK",
        `Rendering fallback from JsonCv | markdownHasTEST=${refined.markdown.includes("TEST_EDIT")} | jsonCvHasTEST=${JSON.stringify(refined.jsonCv).includes("TEST_EDIT")}`
      );
      
      const rawHtml = renderSemanticHtml(refined.jsonCv as JsonCv, currentDesignComposition, designState);
      const html = sanitizeCvHtml(rawHtml);
      const pdfPath = `/tmp/${jobId}_refine_${Date.now()}.pdf`;
      await convertHtmlToPdf(html, pdfPath, designState.layoutId);

      finalResult = {
        html,
        pdfPath,
        designComposition: currentDesignComposition,
        designState,
      };
      log.info("DESIGNER", "Composition-preserved fallback applied");
    }

    log.info("SAVING_COMPOSITION", `layout="${finalResult.designComposition.layoutId}" theme="${finalResult.designComposition.themeId}"`);

    await updateJob(jobId, {
      jsonCv: refined.jsonCv,
      markdownOutput: refined.markdown,
      htmlOutput: finalResult.html,
      pdfPathOutput: finalResult.pdfPath,
      designComposition: finalResult.designComposition,
      designState: finalResult.designState ?? null,
    });

    await refinementComplete(
      jobId,
      finalResult.designState
        ? serializeDesignState(finalResult.designState)
        : undefined,
      log
    );

    log.info("REFINE", "Refinement pipeline complete");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("REFINE", `CRITICAL: ${msg}`);
    await markError(jobId, msg, log);
  } finally {
    try { await unloadAllModels(); } catch (e) { log.warn("VRAM", `Unload failed: ${e}`); }
  }
}
