import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

/* ── cv_jobs: master record for each CV optimization job ───────────────────── */

export const cvJobs = sqliteTable("cv_jobs", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  inputType: text("input_type", { enum: ["pdf", "url"] }).notNull(),
  sourceUrl: text("source_url"),
  pdfPath: text("pdf_path"),
  rawText: text("raw_text"),
  updates: text("updates"),
  jobAdvert: text("job_advert"),

  // JSON pipeline fields
  jsonProfile: text("json_profile"),
  jsonStrategy: text("json_strategy"),
  jsonCv: text("json_cv"),

  // Design composition — the canonical persisted design model (replaces templateId)
  // Contains: { layoutId, themeId, semanticState, renderingOverrides }
  designComposition: text("design_composition"),

  // Fully resolved concrete rendering state
  designState: text("design_state"),

  // Domain detected by Fetcher
  domain: text("domain").default("unknown"),

  // Session tracking for two-state system
  sessionId: text("session_id"),

  // Current state: "main" = initial generation, "refine" = refinement loop
  currentState: text("current_state", { enum: ["main", "refine"] }).default("main"),

  // Version counter
  version: integer("version", { mode: "number" }).default(1),

  status: text("status", {
    enum: [
      "pending",
      "fetching",
      "analyzing",
      "writing",
      "designing",
      "awaiting_review",
      "refining",
      "completed",
      "error",
    ],
  })
    .notNull()
    .default("pending"),

  // Backup fields for restore previous CV
  backupHtml: text("backup_html"),
  backupMarkdown: text("backup_markdown"),
  backupPdfPath: text("backup_pdf_path"),
  backupJsonCv: text("backup_json_cv"),
  backupDesignComposition: text("backup_design_composition"),
  backupDesignState: text("backup_design_state"),

  currentAgent: text("current_agent"),
  agentMessage: text("agent_message"),
  fetcherOutput: text("fetcher_output"),
  analystOutput: text("analyst_output"),
  writerOutput: text("writer_output"),
  markdownOutput: text("markdown_output"),
  htmlOutput: text("html_output"),
  pdfPathOutput: text("pdf_path_output"),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/* ── cv_versions: per-version audit trail ───────────────────────────────── */

export const cvVersions = sqliteTable("cv_versions", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),

  // Link to parent job
  jobId: integer("job_id", { mode: "number" }).notNull(),

  // Session identifier
  sessionId: text("session_id").notNull(),

  // State: "main" = initial, "refine" = iteration
  state: text("state", { enum: ["main", "refine"] }).notNull(),

  // Version number
  version: integer("version", { mode: "number" }).notNull(),

  // CV content snapshots
  jsonCv: text("json_cv"),
  markdownContent: text("markdown_content"),
  htmlContent: text("html_content"),
  pdfPath: text("pdf_path"),

  // Design composition snapshot (layoutId, themeId, semanticState, renderingOverrides)
  designComposition: text("design_composition"),

  // Fully resolved design state snapshot
  designState: text("design_state"),

  // User instruction that triggered this version
  instruction: text("instruction"),

  // Status
  status: text("status", {
    enum: ["pending", "writing", "designing", "completed", "error"],
  })
    .notNull()
    .default("pending"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
