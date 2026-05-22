/**
 * Pipeline Versioning — backup/restore full job state
 *
 * Delegates persistence to CvJobRepository.
 * NO direct database access.
 */

import { createBackup, restoreFromBackup, findJobById } from "../repositories/cv-job-repository";
import type { DesignState } from "../design-system/rendering/types";
import { deserializeDesignState } from "../design-system/rendering/serialize";
import { logger } from "../infrastructure/logging/logger";

export async function createVersion(
  jobId: number,
  state: "main" | "refine",
  jsonCv: Record<string, unknown>,
  markdown: string,
  html: string,
  pdfPath: string,
  designComposition: string,
  designStateStr: string,
  instruction?: string
) {
  const log = logger({ jobId });
  await createBackup(
    jobId, jsonCv, markdown, html, pdfPath, designComposition, designStateStr, log
  );
  log.info("VERSION", `${state} version backed up`);
}

export async function getLatestVersion(jobId: number): Promise<{
  json_cv: Record<string, unknown> | null;
  markdown_content: string;
  html_content: string;
  pdf_path: string;
  design_composition: string;
  design_state: DesignState | undefined;
  instruction: string | null;
} | null> {
  const job = await findJobById(jobId);
  if (!job) return null;

  return {
    json_cv: job.jsonCv,
    markdown_content: job.markdownOutput ?? "",
    html_content: job.htmlOutput ?? "",
    pdf_path: job.pdfPathOutput ?? "",
    design_composition: job.designComposition ?? "",
    design_state: job.designState ?? undefined,
    instruction: null,
  };
}
