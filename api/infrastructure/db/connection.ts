import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;
let sqliteInstance: InstanceType<typeof Database>;
let initialized = false;

export function getDb() {
  if (!instance) {
    sqliteInstance = new Database("cv_optimizer.db");
    sqliteInstance.pragma("journal_mode = WAL");
    instance = drizzle(sqliteInstance, {
      schema: fullSchema,
    });
  }
  return instance;
}

export function getSQLite() {
  if (!sqliteInstance) {
    getDb();
  }
  return sqliteInstance!;
}

/**
 * Initialize the database by creating all tables from the schema.
 * Called once on server startup.
 */
export function initDatabase() {
  if (initialized) return;

  const sqlite = getSQLite();

  // Check if table exists with old schema (template_id column)
  const pragmaInfo = sqlite.prepare("PRAGMA table_info(cv_jobs)").all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;
  const hasOldTemplateId = pragmaInfo.find((c) => c.name === "template_id");
  const hasNewDesignComposition = pragmaInfo.find((c) => c.name === "design_composition");

  // Migration: if table has old template_id but NOT design_composition, recreate
  if (hasOldTemplateId && !hasNewDesignComposition) {
    console.log("[DB] Migrating from template-centric to composition-native schema...");
    sqlite.exec(`
      BEGIN TRANSACTION;
      ALTER TABLE cv_jobs RENAME TO cv_jobs_old;
      DROP TABLE IF EXISTS cv_jobs_old;
      COMMIT;
    `);
    console.log("[DB] Dropped old table. Creating new schema...");
  }

  // cv_jobs table (composition-native: design_composition replaces template_id)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cv_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_type TEXT NOT NULL,
      source_url TEXT,
      pdf_path TEXT,
      raw_text TEXT,
      updates TEXT,
      job_advert TEXT,
      json_profile TEXT,
      json_strategy TEXT,
      json_cv TEXT,
      design_composition TEXT,
      design_state TEXT,
      domain TEXT DEFAULT 'unknown',
      session_id TEXT,
      current_state TEXT DEFAULT 'main',
      version INTEGER DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      backup_html TEXT,
      backup_markdown TEXT,
      backup_pdf_path TEXT,
      backup_json_cv TEXT,
      backup_design_composition TEXT,
      backup_design_state TEXT,
      current_agent TEXT,
      agent_message TEXT,
      fetcher_output TEXT,
      analyst_output TEXT,
      writer_output TEXT,
      markdown_output TEXT,
      html_output TEXT,
      pdf_path_output TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // cv_versions table (composition-native)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cv_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      state TEXT NOT NULL,
      version INTEGER NOT NULL,
      json_cv TEXT,
      markdown_content TEXT,
      html_content TEXT,
      pdf_path TEXT,
      design_composition TEXT,
      design_state TEXT,
      instruction TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Indexes
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cv_jobs_status ON cv_jobs(status);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cv_versions_job ON cv_versions(job_id);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cv_versions_session ON cv_versions(session_id);`);
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cv_versions_latest ON cv_versions(job_id, version DESC);`);

  // Safe ALTER TABLE migrations (idempotent)
  const cvJobsColumns = [
    "updates TEXT",
    "json_profile TEXT",
    "json_strategy TEXT",
    "json_cv TEXT",
    "design_composition TEXT",
    "design_state TEXT",
    "backup_design_composition TEXT",
    "backup_design_state TEXT",
    "backup_html TEXT",
    "backup_markdown TEXT",
    "backup_pdf_path TEXT",
    "backup_json_cv TEXT",
    "session_id TEXT",
    "current_state TEXT DEFAULT 'main'",
    "version INTEGER DEFAULT 1",
    "domain TEXT DEFAULT 'unknown'",
  ];
  for (const colDef of cvJobsColumns) {
    const colName = colDef.split(" ")[0];
    try {
      sqlite.exec(`ALTER TABLE cv_jobs ADD COLUMN ${colDef};`);
      console.log(`[DB] Added '${colName}' column to cv_jobs`);
    } catch {
      // Column already exists
    }
  }

  const cvVersionsColumns = [
    "design_composition TEXT",
    "design_state TEXT",
  ];
  for (const colDef of cvVersionsColumns) {
    const colName = colDef.split(" ")[0];
    try {
      sqlite.exec(`ALTER TABLE cv_versions ADD COLUMN ${colDef};`);
      console.log(`[DB] Added '${colName}' column to cv_versions`);
    } catch {
      // Column already exists
    }
  }

  initialized = true;
  console.log("[DB] SQLite database initialized successfully (composition-native schema)");
}
