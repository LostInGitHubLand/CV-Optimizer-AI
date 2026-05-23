/**
 * Repository — CvJob
 *
 * SINGLE SOURCE OF TRUTH for all cvJobs database operations.
 * Composition-native: uses designComposition instead of templateId.
 */

import { eq } from "drizzle-orm";
import { getDb } from "../infrastructure/db/connection";
import { cvJobs } from "../infrastructure/db/schema";
import type { CvJob, CreateJobDto, UpdateJobDto } from "../domain/contracts/types";
import { JobStatus, validateTransition } from "../domain/workflow/job-status";
import { serializeCvJob, toDbUpdate } from "../application/serializers/cv-job-serializer";
import type { Logger } from "../infrastructure/logging/logger";

/* ── CREATE ─────────────────────────────────────────────────────────────── */

export async function createJobRepo(dto: CreateJobDto, sessionId: string): Promise<number> {
  const result = await getDb()
    .insert(cvJobs)
    .values({
      inputType: dto.inputType,
      sourceUrl: dto.sourceUrl ?? null,
      jobAdvert: dto.jobAdvert ?? null,
      updates: dto.updates ?? null,
      sessionId,
      status: JobStatus.Pending,
      currentState: "main",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: cvJobs.id });
  return result[0].id;
}

export async function createTestJobRepo(): Promise<number> {
  const result = await getDb()
    .insert(cvJobs)
    .values({
      inputType: "test",
      status: JobStatus.Pending,
      currentState: "main",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: cvJobs.id });
  return result[0].id;
}

/* ── READ ───────────────────────────────────────────────────────────────── */

export async function findJobById(id: number): Promise<CvJob | null> {
  const rows = await getDb().select().from(cvJobs).where(eq(cvJobs.id, id)).limit(1);
  if (!rows.length) return null;
  return serializeCvJob(rows[0]);
}

export async function findJobStatusAndAgent(id: number): Promise<{
  status: JobStatus;
  currentAgent: string | null;
} | null> {
  const rows = await getDb()
    .select({ status: cvJobs.status, currentAgent: cvJobs.currentAgent })
    .from(cvJobs)
    .where(eq(cvJobs.id, id))
    .limit(1);
  if (!rows.length) return null;
  return {
    status: rows[0].status as JobStatus,
    currentAgent: rows[0].currentAgent,
  };
}

export async function findRawTextById(id: number): Promise<string | null> {
  const rows = await getDb()
    .select({ rawText: cvJobs.rawText })
    .from(cvJobs)
    .where(eq(cvJobs.id, id))
    .limit(1);
  return rows[0]?.rawText ?? null;
}

export async function findBackupById(id: number): Promise<{
  backupJsonCv: string | null;
  backupMarkdown: string | null;
  backupHtml: string | null;
  backupPdfPath: string | null;
  backupDesignComposition: string | null;
  backupDesignState: string | null;
} | null> {
  const rows = await getDb()
    .select({
      backupJsonCv: cvJobs.backupJsonCv,
      backupMarkdown: cvJobs.backupMarkdown,
      backupHtml: cvJobs.backupHtml,
      backupPdfPath: cvJobs.backupPdfPath,
      backupDesignComposition: cvJobs.backupDesignComposition,
      backupDesignState: cvJobs.backupDesignState,
    })
    .from(cvJobs)
    .where(eq(cvJobs.id, id))
    .limit(1);
  if (!rows.length) return null;
  return rows[0];
}

/* ── UPDATE ─────────────────────────────────────────────────────────────── */

export async function updateJob(id: number, dto: UpdateJobDto): Promise<void> {
  const dbValues = toDbUpdate(dto);
  if (Object.keys(dbValues).length === 0) return;
  await getDb()
    .update(cvJobs)
    .set({ ...dbValues, updatedAt: new Date() })
    .where(eq(cvJobs.id, id));
}

export async function updateJobStatus(
  id: number,
  status: JobStatus,
  currentAgent?: string | null,
  agentMessage?: string | null,
  extra?: Partial<typeof cvJobs.$inferSelect>,
  log?: Logger
): Promise<void> {
  const setClause: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
    ...extra,
  };
  if (currentAgent !== undefined) setClause.currentAgent = currentAgent;
  if (agentMessage !== undefined) setClause.agentMessage = agentMessage;

  await getDb()
    .update(cvJobs)
    .set(setClause)
    .where(eq(cvJobs.id, id));
}

export async function transitionStatus(
  id: number,
  to: JobStatus,
  currentAgent?: string | null,
  agentMessage?: string | null,
  extra?: Partial<typeof cvJobs.$inferSelect>,
  log?: Logger
): Promise<{ oldStatus: JobStatus; newStatus: JobStatus }> {
  const rows = await getDb()
    .select({ status: cvJobs.status })
    .from(cvJobs)
    .where(eq(cvJobs.id, id))
    .limit(1);
  if (!rows.length) throw new Error(`Job ${id} not found for status transition`);

  const oldStatus = rows[0].status as JobStatus;

  if (oldStatus !== to) {
    validateTransition(oldStatus, to);
    if (log) {
      log.info("STATE_MACHINE", `"${oldStatus}" → "${to}" (agent=${currentAgent ?? ""}, msg=${agentMessage ?? ""})`);
    }
  }

  await updateJobStatus(id, to, currentAgent, agentMessage, extra);
  return { oldStatus, newStatus: to };
}

export async function saveRawText(id: number, rawText: string): Promise<void> {
  await getDb()
    .update(cvJobs)
    .set({ rawText, updatedAt: new Date() })
    .where(eq(cvJobs.id, id));
}

export async function savePdfUpload(
  id: number,
  pdfPath: string,
  log?: Logger
): Promise<void> {
  await getDb()
    .update(cvJobs)
    .set({ pdfPath, status: JobStatus.Uploaded, updatedAt: new Date() })
    .where(eq(cvJobs.id, id));
}

/* ── BACKUP / RESTORE ───────────────────────────────────────────────────── */

export async function createBackup(
  id: number,
  jsonCv: Record<string, unknown>,
  markdown: string,
  html: string,
  pdfPath: string,
  designCompositionStr: string,
  designStateStr?: string,
  log?: Logger
): Promise<void> {
  await getDb()
    .update(cvJobs)
    .set({
      backupJsonCv: JSON.stringify(jsonCv),
      backupMarkdown: markdown,
      backupHtml: html,
      backupPdfPath: pdfPath,
      backupDesignComposition: designCompositionStr,
      backupDesignState: designStateStr ?? null,
      updatedAt: new Date(),
    })
    .where(eq(cvJobs.id, id));
}

export async function restoreFromBackup(id: number, log?: Logger): Promise<{
  markdown: string;
  designComposition: string | null;
} | null> {
  const rows = await getDb().select().from(cvJobs).where(eq(cvJobs.id, id)).limit(1);
  if (!rows.length) return null;
  const j = rows[0];

  if (!j.backupJsonCv) return null;

  await getDb()
    .update(cvJobs)
    .set({
      jsonCv: j.backupJsonCv,
      markdownOutput: j.backupMarkdown,
      htmlOutput: j.backupHtml,
      pdfPathOutput: j.backupPdfPath,
      designComposition: j.backupDesignComposition,
      designState: j.backupDesignState,
      status: JobStatus.AwaitingReview,
      currentAgent: "",
      agentMessage: "Previous version restored.",
      updatedAt: new Date(),
    })
    .where(eq(cvJobs.id, id));

  return {
    markdown: j.backupMarkdown ?? "",
    designComposition: j.backupDesignComposition ?? null,
  };
}
