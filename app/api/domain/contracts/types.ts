import type { JsonCv } from "../../agents/writer";
import type { DesignComposition } from "../../design-system/composition";

// ── Design Composition is defined canonically in design-system/composition.ts
// Re-exported here for domain-layer convenience
export type { DesignComposition };

// ── Job State Machine ──
export type JobState =
  | "pending"
  | "fetching"
  | "analyzing"
  | "writing"
  | "designing"
  | "awaiting_review"
  | "refining"
  | "completed"
  | "error";

// ── Create Job DTO ──
export interface CreateJobDto {
  inputType: "pdf" | "url";
  sourceUrl?: string;
  pdfPath?: string;
  rawText?: string;
  jobAdvert?: string;
  updates?: string;
  sessionId?: string;
}

// ── Job Progress ──
export interface JobProgress {
  state: JobState;
  agent: string;
  message: string;
  tokens: number;
  timestamp: string;
}

// ── Version Snapshot ──
export interface JobVersion {
  version: number;
  state: "main" | "refine";
  jsonCv?: JsonCv;
  markdownContent?: string;
  htmlContent?: string;
  pdfPath?: string;
  designComposition?: DesignComposition;
  designState?: string;
  instruction?: string;
  status: string;
  createdAt: Date;
}

// ── Update Job DTO (partial update) ──
export interface UpdateJobDto {
  status?: JobState;
  currentAgent?: string;
  agentMessage?: string;
  jobAdvert?: string;
  updates?: string;
  rawText?: string;
  domain?: string;
  jsonProfile?: Record<string, unknown>;
  jsonStrategy?: Record<string, unknown>;
  jsonCv?: Record<string, unknown>;
  fetcherOutput?: string;
  analystOutput?: string;
  writerOutput?: string;
  markdownOutput?: string;
  htmlOutput?: string;
  pdfPathOutput?: string;
  designComposition?: DesignComposition;
  designState?: DesignState | null;
  errorMessage?: string;
  backupJsonCv?: string;
  backupMarkdown?: string;
  backupHtml?: string;
  backupPdfPath?: string;
  backupDesignComposition?: DesignComposition;
  backupDesignState?: string;
}

// ── Job (full domain model) ──
export interface CvJob {
  id: number;
  inputType: "pdf" | "url";
  sourceUrl?: string;
  pdfPath?: string;
  rawText?: string;
  updates?: string;
  jobAdvert?: string;
  domain: string;
  status: JobState;
  currentState: "main" | "refine";
  version: number;
  sessionId?: string;
  currentAgent?: string;
  agentMessage?: string;
  jsonProfile?: Record<string, unknown> | null;
  jsonStrategy?: Record<string, unknown> | null;
  jsonCv?: Record<string, unknown> | null;
  designComposition: DesignComposition | null;
  designState: string | null;
  fetcherOutput?: string;
  analystOutput?: string;
  writerOutput?: string;
  markdownOutput?: string;
  htmlOutput?: string;
  pdfPathOutput?: string;
  errorMessage?: string;
  backupJsonCv?: string;
  backupMarkdown?: string;
  backupHtml?: string;
  backupPdfPath?: string;
  backupDesignComposition: DesignComposition | null;
  backupDesignState?: string;
  hasBackup: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Forward reference — resolved at import time
import type { DesignState } from "../../design-system/rendering/types";
