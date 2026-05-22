/**
 * Application — Job Service
 *
 * Business operations for CV job lifecycle:
 *   - Create, read, update jobs
 *   - Upload PDFs
 *   - Domain detection
 *   - Status transitions (with validation)
 *   - Backup/restore
 *
 * SINGLE POINT for all job mutation logic.
 * No direct DB access — delegates to CvJobRepository.
 */

import { randomUUID } from "crypto";
import {
  createJobRepo,
  createTestJobRepo,
  findJobById,
  findJobStatusAndAgent,
  findRawTextById,
  saveRawText,
  savePdfUpload,
  transitionStatus,
  restoreFromBackup,
  updateJob,
} from "../../repositories/cv-job-repository";
import { extractTextFromPdf, savePdfFile } from "../../infrastructure/pdf";
import { detectDomain } from "../../agents/domain-detector";
import { JobStatus } from "../../domain/workflow/job-status";
import type { CreateJobDto, CvJob, UpdateJobDto } from "../../domain/contracts/types";
import type { Logger } from "../../infrastructure/logging/logger";

/* ── CREATE ─────────────────────────────────────────────────────────────── */

export async function createJob(
  dto: CreateJobDto,
  log: Logger
): Promise<{ id: number; sessionId: string }> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const id = await createJobRepo(dto, sessionId);
  log.info("JOB_SERVICE", `Job ${id} created (session: ${sessionId})`);
  return { id, sessionId };
}

export async function createTestJob(log: Logger): Promise<number> {
  const id = await createTestJobRepo();
  log.info("JOB_SERVICE", `Test job ${id} created`);
  return id;
}

/* ── READ ───────────────────────────────────────────────────────────────── */

export async function getJob(id: number): Promise<CvJob | null> {
  return findJobById(id);
}

export async function getJobStatus(id: number): Promise<{
  status: JobStatus;
  currentAgent: string | null;
} | null> {
  return findJobStatusAndAgent(id);
}

export async function assertJobExists(id: number): Promise<CvJob> {
  const job = await findJobById(id);
  if (!job) throw new Error(`Job ${id} not found`);
  return job;
}

export async function assertStatusAllowsRefine(id: number): Promise<CvJob> {
  const job = await assertJobExists(id);
  if (job.status !== JobStatus.AwaitingReview) {
    throw new Error(`Cannot refine: job status is "${job.status}", expected "awaiting_review"`);
  }
  return job;
}

/* ── UPDATE ─────────────────────────────────────────────────────────────── */

export async function modifyJob(id: number, dto: UpdateJobDto, log?: Logger): Promise<void> {
  await updateJob(id, dto);
}

export async function changeJobStatus(
  id: number,
  to: JobStatus,
  currentAgent?: string | null,
  agentMessage?: string | null,
  extra?: Record<string, unknown>,
  log?: Logger
): Promise<{ oldStatus: JobStatus; newStatus: JobStatus }> {
  return transitionStatus(id, to, currentAgent, agentMessage, extra, log);
}

export async function submitUpdates(id: number, updates: string, log?: Logger): Promise<void> {
  await updateJob(id, { updates });
}

export async function setJobAdvert(id: number, jobAdvert: string, log?: Logger): Promise<void> {
  await updateJob(id, { jobAdvert });
}

export async function detectAndSetDomain(
  id: number,
  rawText: string | null,
  jobAdvert: string,
  log: Logger
): Promise<string> {
  const textForDomain = rawText || jobAdvert || "";
  const domain = detectDomain(textForDomain);
  await updateJob(id, { domain, jobAdvert });
  log.info("JOB_SERVICE", `Domain detected: ${domain}`);
  return domain;
}

/* ── PDF ────────────────────────────────────────────────────────────────── */

export async function uploadJobPdf(
  id: number,
  pdfBase64: string,
  log: Logger
): Promise<{ filePath: string }> {
  await assertJobExists(id);
  const uniqueName = `${id}_${randomUUID().slice(0, 8)}.pdf`;
  const buffer = Buffer.from(pdfBase64, "base64");
  const filePath = await savePdfFile(buffer, { filename: uniqueName });
  await savePdfUpload(id, filePath);
  log.info("JOB_SERVICE", `PDF uploaded: ${uniqueName}`);
  return { filePath };
}

export async function extractPdfTextIfNeeded(
  id: number,
  log: Logger
): Promise<string> {
  const rawText = await findRawTextById(id);
  if (rawText) return rawText;

  const job = await findJobById(id);
  if (job?.pdfPath) {
    log.info("JOB_SERVICE", "Extracting text from PDF...");
    const extracted = await extractTextFromPdf(job.pdfPath);
    await saveRawText(id, extracted);
    return extracted;
  }
  return "";
}

/* ── BACKUP / RESTORE ───────────────────────────────────────────────────── */

export async function restoreJobBackup(
  id: number,
  log: Logger
): Promise<{ success: boolean; markdown: string; designComposition: DesignComposition | null }> {
  const result = await restoreFromBackup(id, log);
  if (!result) {
    throw new Error("No backup available — refine at least once to create a backup.");
  }
  log.info("JOB_SERVICE", "Backup restored successfully");
  const composition = result.designComposition ? JSON.parse(result.designComposition) as DesignComposition : null;
  return { success: true, markdown: result.markdown, designComposition: composition };
}
