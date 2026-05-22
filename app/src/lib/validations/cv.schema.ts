import { z } from "zod";

/**
 * ── Post-parse sanitization ────────────────────────────────────────────
 */
const PLACEHOLDER_STRINGS = new Set(["undefined", "null", "na", "n/a", "none", "unknown", "not specified", "not available", "unspecified", "no data"]);

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_STRINGS.has(value.toLowerCase().trim());
}

const SanitizedString = z.string().transform((val) => isPlaceholder(val) ? "" : val).catch("");
const SanitizedOptionalString = z.string().transform((val) => isPlaceholder(val) ? "" : val).optional().catch("");

/* ── Schema Firewall: Active Sanitization ─────────────────────────────────── */

const INVENTED_METRIC_PATTERNS = [
  /\b(increased|decreased|reduced|improved|boosted|grew|achieved)\s+(by\s+)?\d+[\d,]*\s*(%|\$|x|times)\b/gi,
  /\b(managed|led|oversaw|directed)\s+a?\s*(team|budget|portfolio|pipeline)\s+of\s+\d+[\d,]*\b/gi,
  /\b\d+[\d,]*\+?\s*(users?|customers?|clients?|employees?|people|team members?)\b/gi,
  /\$\d+[\d,]*[KMB]?\b/gi,
  /\b\d+\.?\d*\s*%\s*(uptime|efficiency|accuracy|coverage|completion)\b/gi,
  /\b(grew|expanded|scaled)\s+(to|by)\s+\d+[\d,]*[KMB+]?\b/gi,
];

export function stripInventedMetrics(text: string): string {
  let cleaned = text;
  for (const pattern of INVENTED_METRIC_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match) => {
      console.log(`[SCHEMA_FIREWALL] Stripped invented metric: "${match}"`);
      if (/increased|improved|boosted|grew/i.test(match)) return "significantly improved";
      if (/reduced|decreased/i.test(match)) return "significantly reduced";
      if (/managed|led|oversaw/i.test(match)) return match.replace(/of\s+\d+[\d,]*/i, "");
      return "";
    });
  }
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

const MetricSanitizedString = z.string().transform((val) => {
  if (isPlaceholder(val)) return "";
  return stripInventedMetrics(val);
}).catch("");

const MetricSanitizedOptionalString = z.string().transform((val) => {
  if (isPlaceholder(val)) return "";
  return stripInventedMetrics(val);
}).optional().catch("");

/* ── Sub-schemas ─────────────────────────────────────────────────────────── */

const ExperienceEntrySchema = z.object({
  role: SanitizedString,
  company: SanitizedString,
  location: SanitizedOptionalString,
  startDate: SanitizedString,
  endDate: SanitizedString,
  description: MetricSanitizedString,
  achievements: z.array(MetricSanitizedString).catch([]),
}).passthrough();

const EducationEntrySchema = z.object({
  degree: SanitizedString,
  institution: SanitizedString,
  field: SanitizedOptionalString,
  year: SanitizedString,
  startDate: SanitizedOptionalString,
  grade: SanitizedOptionalString,
  details: MetricSanitizedOptionalString,
}).passthrough();

const CertificationEntrySchema = z.object({
  name: SanitizedString,
  issuer: SanitizedOptionalString,
  year: SanitizedOptionalString,
  description: MetricSanitizedOptionalString,
}).passthrough();

const ProjectEntrySchema = z.object({
  name: SanitizedString,
  description: MetricSanitizedString,
  technologies: z.array(SanitizedString).optional().catch([]),
}).passthrough();

const ContactSchema = z.object({
  email: SanitizedOptionalString,
  phone: SanitizedOptionalString,
  linkedin: SanitizedOptionalString,
  location: SanitizedOptionalString,
  website: SanitizedOptionalString,
  additionalLinks: z.array(
    z.object({
      label: SanitizedString,
      url: SanitizedString,
    }).passthrough()
  ).optional().catch([]),
}).passthrough();

const SkillsSchema = z.object({
  technical: z.array(SanitizedString).catch([]),
  soft: z.array(SanitizedString).catch([]),
  languages: z.array(SanitizedString).catch([]),
  tools: z.array(SanitizedString).catch([]),
}).passthrough();

/* ── Root: JsonProfile ──────────────────────────────────────────────────── */

export const JsonProfileSchema = z.object({
  name: SanitizedString,
  title: SanitizedString,
  contact: ContactSchema.catch({ email: "", phone: "", linkedin: "", location: "", website: "" }),
  summary: MetricSanitizedString,
  experience: z.array(ExperienceEntrySchema).catch([]),
  education: z.array(EducationEntrySchema).catch([]),
  skills: SkillsSchema.catch({ technical: [], soft: [], languages: [], tools: [] }),
  certifications: z.array(CertificationEntrySchema).catch([]),
  projects: z.array(ProjectEntrySchema).catch([]),
  awards: z.array(SanitizedString).catch([]),
  publications: z.array(SanitizedString).catch([]),
  volunteer: z.array(SanitizedString).catch([]),
  interests: z.array(SanitizedString).catch([]),
}).passthrough();

export type JsonProfile = z.infer<typeof JsonProfileSchema>;

export interface FetcherResult {
  jsonProfile: JsonProfile;
  rawText: string;
  domain: string;
}

/* ════════════════════════════════════════════════════════════════════════
   STATE-AWARE SCHEMAS — Two-State System (MAIN_STATE vs REFINE_STATE)
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Pipeline state — every job is either in initial generation or refinement.
 */
export const PipelineStateSchema = z.enum(["main", "refine"]);
export type PipelineState = z.infer<typeof PipelineStateSchema>;

/**
 * WriterState — discriminated union by mode.
 * Zod validates the correct shape for each operational mode.
 */
export const WriterMainInputSchema = z.object({
  mode: z.literal("main"),
  jsonProfile: JsonProfileSchema,
  jobAdvert: z.string().min(1),
  strategy: z.record(z.unknown()).catch({}),
  title: z.string().optional(),
  domain: z.string().optional(),
});

export const WriterRefineInputSchema = z.object({
  mode: z.literal("refine"),
  currentJsonCv: z.record(z.unknown()),
  currentMarkdown: z.string(),
  instruction: z.string().optional().default(""),
  title: z.string().optional(),
  domain: z.string().optional(),
});

export const WriterStateSchema = z.discriminatedUnion("mode", [
  WriterMainInputSchema,
  WriterRefineInputSchema,
]);

export type WriterMainInput = z.infer<typeof WriterMainInputSchema>;
export type WriterRefineInput = z.infer<typeof WriterRefineInputSchema>;
export type WriterState = z.infer<typeof WriterStateSchema>;

/**
 * DesignerState — discriminated union by mode.
 */
export const DesignerMainInputSchema = z.object({
  mode: z.literal("main"),
  jsonCv: z.record(z.unknown()),
  jobTitle: z.string(),
  domain: z.string().default("unknown"),
});

export const DesignerRefineInputSchema = z.object({
  mode: z.literal("refine"),
  jsonCv: z.record(z.unknown()),
  jobTitle: z.string(),
  domain: z.string().default("unknown"),
  currentTemplateId: z.string().optional(),
  instruction: z.string().optional().default(""),
});

export const DesignerStateSchema = z.discriminatedUnion("mode", [
  DesignerMainInputSchema,
  DesignerRefineInputSchema,
]);

export type DesignerMainInput = z.infer<typeof DesignerMainInputSchema>;
export type DesignerRefineInput = z.infer<typeof DesignerRefineInputSchema>;
export type DesignerState = z.infer<typeof DesignerStateSchema>;

/**
 * Version record schema — used for cv_versions table validation.
 */
export const CvVersionSchema = z.object({
  id: z.number().optional(),
  jobId: z.number(),
  sessionId: z.string().min(1),
  state: PipelineStateSchema,
  version: z.number().min(1),
  jsonCv: z.string().optional(),
  markdownContent: z.string().optional(),
  htmlContent: z.string().optional(),
  pdfPath: z.string().optional(),
  templateId: z.string().optional(),
  instruction: z.string().optional(),
  status: z.enum(["pending", "writing", "designing", "completed", "error"]).default("pending"),
  createdAt: z.number().optional(),
});

export type CvVersion = z.infer<typeof CvVersionSchema>;
