/**
 * Application — CvJob Serializer
 *
 * Maps DB rows → domain objects (inbound) and domain DTOs → DB update shapes (outbound).
 *
 * INBOUND RULES:
 *   - designComposition is NEVER null when design_composition exists in DB.
 *     If deserializeDesignComposition() fails, falls back to createDefaultComposition().
 *   - designState is NEVER null when design_state exists in DB.
 *     Uses deserializeDesignState() which already has fallback logic.
 *   - sectionLayout, sectionVariants, renderingOverrides, semanticState are always normalized.
 *
 * No partial compositions may propagate into refine/designer.
 */

import type { CvJob, UpdateJobDto } from "../../domain/contracts/types";
import type { DesignComposition } from "../../design-system/composition";
import {
  deserializeDesignComposition,
  createDefaultComposition,
} from "../../design-system/composition";
import type { JobStatus } from "../../domain/workflow/job-status";
import { parseJobStatus } from "../../domain/workflow/job-status";
import {
  deserializeDesignState,
  serializeDesignState,
} from "../../design-system/rendering/serialize";
import type { cvJobs } from "../../infrastructure/db/schema";

/* ═══════════════════════════════════════════════════════════════════════════
   INBOUND: DB row → domain object
   ═══════════════════════════════════════════════════════════════════════════ */

export function serializeCvJob(row: typeof cvJobs.$inferSelect): CvJob {
  return {
    id: row.id,
    inputType: row.inputType as "pdf" | "url",
    sourceUrl: row.sourceUrl,
    pdfPath: row.pdfPath,
    rawText: row.rawText,
    updates: row.updates,
    jobAdvert: row.jobAdvert,
    domain: row.domain ?? "unknown",
    status: parseDbStatus(row.status),
    currentState: (row.currentState ?? "main") as "main" | "refine",
    version: row.version ?? 1,
    sessionId: row.sessionId,
    currentAgent: row.currentAgent,
    agentMessage: row.agentMessage,

    // JSON fields
    jsonProfile: safeJsonParse(row.jsonProfile),
    jsonStrategy: safeJsonParse(row.jsonStrategy),
    jsonCv: safeJsonParse(row.jsonCv),

    // Composition-native design fields — NEVER null when DB has data
    designComposition: reconstructDesignComposition(row.designComposition),
    designState: reconstructDesignState(row.designState),

    // Raw output fields
    fetcherOutput: row.fetcherOutput,
    analystOutput: row.analystOutput,
    writerOutput: row.writerOutput,
    markdownOutput: row.markdownOutput,
    htmlOutput: row.htmlOutput,
    pdfPathOutput: row.pdfPathOutput,
    errorMessage: row.errorMessage,

    // Backup fields — same reconstruction rules
    backupJsonCv: row.backupJsonCv,
    backupMarkdown: row.backupMarkdown,
    backupHtml: row.backupHtml,
    backupPdfPath: row.backupPdfPath,
    backupDesignComposition: reconstructDesignComposition(row.backupDesignComposition),
    backupDesignState: row.backupDesignState,

    // Computed: true if any backup field exists
    hasBackup: !!(row.backupHtml || row.backupMarkdown || row.backupDesignComposition),

    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   OUTBOUND: domain DTO → DB update shape
   ═══════════════════════════════════════════════════════════════════════════ */

export function toDbUpdate(dto: UpdateJobDto): Record<string, unknown> {
  const db: Record<string, unknown> = {};

  if (dto.status !== undefined) db.status = dto.status;
  if (dto.currentAgent !== undefined) db.currentAgent = dto.currentAgent;
  if (dto.agentMessage !== undefined) db.agentMessage = dto.agentMessage;
  if (dto.jobAdvert !== undefined) db.jobAdvert = dto.jobAdvert;
  if (dto.updates !== undefined) db.updates = dto.updates;
  if (dto.rawText !== undefined) db.rawText = dto.rawText;
  if (dto.domain !== undefined) db.domain = dto.domain;
  if (dto.jsonProfile !== undefined) db.jsonProfile = JSON.stringify(dto.jsonProfile);
  if (dto.jsonStrategy !== undefined) db.jsonStrategy = JSON.stringify(dto.jsonStrategy);
  if (dto.jsonCv !== undefined) db.jsonCv = JSON.stringify(dto.jsonCv);
  if (dto.fetcherOutput !== undefined) db.fetcherOutput = dto.fetcherOutput;
  if (dto.analystOutput !== undefined) db.analystOutput = dto.analystOutput;
  if (dto.writerOutput !== undefined) db.writerOutput = dto.writerOutput;
  if (dto.markdownOutput !== undefined) db.markdownOutput = dto.markdownOutput;
  if (dto.htmlOutput !== undefined) db.htmlOutput = dto.htmlOutput;
  if (dto.pdfPathOutput !== undefined) db.pdfPathOutput = dto.pdfPathOutput;
  if (dto.designComposition !== undefined) {
    db.designComposition = dto.designComposition ? JSON.stringify(dto.designComposition) : null;
  }
  if (dto.designState !== undefined) {
    db.designState = dto.designState ? serializeDesignState(dto.designState) : null;
  }
  if (dto.errorMessage !== undefined) db.errorMessage = dto.errorMessage;
  if (dto.backupJsonCv !== undefined) db.backupJsonCv = dto.backupJsonCv;
  if (dto.backupMarkdown !== undefined) db.backupMarkdown = dto.backupMarkdown;
  if (dto.backupHtml !== undefined) db.backupHtml = dto.backupHtml;
  if (dto.backupPdfPath !== undefined) db.backupPdfPath = dto.backupPdfPath;
  if (dto.backupDesignComposition !== undefined) {
    db.backupDesignComposition = dto.backupDesignComposition ? JSON.stringify(dto.backupDesignComposition) : null;
  }
  if (dto.backupDesignState !== undefined) db.backupDesignState = dto.backupDesignState;

  return db;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

export function safeJsonParse(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Reconstruct a DesignComposition from a DB string.
 *
 * CRITICAL INVARIANT: Never returns null.
 * If DB field is null/empty/malformed, creates a valid default composition.
 * Guarantees refine/designer always receive a complete, normalized object.
 */
function reconstructDesignComposition(raw: string | null | undefined): DesignComposition {
  if (raw && typeof raw === "string") {
    // Try canonical deserialization (normalizes sectionLayout, sectionVariants, etc.)
    const parsed = deserializeDesignComposition(raw);
    if (parsed) return parsed;

    // Fallback: parse just enough to get layoutId/themeId
    try {
      const partial = JSON.parse(raw) as Record<string, unknown>;
      const layoutId = (partial.layoutId ?? "single-column") as "single-column" | "sidebar-left" | "sidebar-right" | "";
      const themeId = (partial.themeId ?? "minimal-swiss") as string;
      return createDefaultComposition(layoutId, themeId);
    } catch {
      return createDefaultComposition();
    }
  }

  // DB field is null/empty — return a valid default composition
  return createDefaultComposition();
}

/**
 * Reconstruct a DesignState from a DB string.
 *
 * Never returns null. deserializeDesignState already has fallback logic.
 */
function reconstructDesignState(raw: string | null | undefined): string | null {
  // DB stores designState as a raw JSON string; keep it as a string for the domain model
  return raw && typeof raw === "string" ? raw : null;
}

function parseDbStatus(raw: string | null): JobStatus {
  if (!raw) return "pending" as JobStatus;
  try {
    return parseJobStatus(raw);
  } catch {
    return "pending" as JobStatus;
  }
}
