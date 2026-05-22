/**
 * Application — Refinement Service
 *
 * Orchestrates the refinement loop.
 * The job's DesignComposition is the single source of truth.
 */

import { runRefinementWithResilience, getLatestVersion } from "../../pipeline";
import { assertStatusAllowsRefine } from "./job-service";
import { publishProgress, markError } from "./progress-service";
import { createBackup } from "../../repositories/cv-job-repository";
import { JobStatus } from "../../domain/workflow/job-status";
import type { Logger } from "../../infrastructure/logging/logger";

export async function executeRefinement(
  jobId: number,
  writerInstruction: string,
  designerInstruction: string,
  editedMarkdown: string | undefined,
  jobAdvert: string,
  _designCompositionStr: string | null | undefined,  // kept for API compat, unused
  logParent: ReturnType<typeof logger>
): Promise<void> {
  const log = logParent.child({ sessionId: `r_${Date.now()}` });

  try {
    // 1. Validate job
    const job = await assertStatusAllowsRefine(jobId);

    // 2. Get version data
    const latest = await getLatestVersion(jobId);

    const currentMarkdown = editedMarkdown?.trim()
      ? editedMarkdown
      : (latest?.markdown_content || job.markdownOutput || "");

    const currentJsonCv = latest?.json_cv ?? job.jsonCv;

    if (!currentJsonCv) {
      throw new Error("No CV data available for refinement");
    }

    // 3. DesignComposition — single source of truth from the job
    // The serializer guarantees a valid DesignComposition (never null).
    const currentDesignComposition = job.designComposition ?? undefined;

    log.info("LOADED_COMPOSITION", `layout="${currentDesignComposition?.layoutId ?? "default"}" theme="${currentDesignComposition?.themeId ?? "default"}"`);

    // 4. Create backup BEFORE running refinement (so user can restore if needed)
    await createBackup(
      jobId,
      currentJsonCv as Record<string, unknown>,
      currentMarkdown,
      job.htmlOutput ?? "",
      job.pdfPathOutput ?? "",
      JSON.stringify(currentDesignComposition ?? {}),
      job.designState ?? undefined,
      log
    );
    log.info("REFINE_SERVICE", "Backup created before refinement");

    // 5. Publish progress
    await publishProgress(jobId, JobStatus.Refining, "REFINE", "Refinement started", undefined, log);

    // 6. Run refinement
    runRefinementWithResilience(
      jobId,
      currentJsonCv,
      currentMarkdown,
      writerInstruction,
      designerInstruction,
      jobAdvert,
      currentDesignComposition,
      log
    ).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("REFINE_SERVICE", `Refinement failed: ${msg}`);
      markError(jobId, msg, log).catch(() => {});
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("REFINE_SERVICE", `Setup failed: ${msg}`);
    await markError(jobId, msg, log);
    throw err;
  }
}