import { queryOllama } from "../infrastructure/ai/ollama";
import type { TokenReporter } from "../infrastructure/ai/ollama";
import { buildWriterSystemRules, buildRefinementSystemRules } from "./core-rules";
import { classifySkill } from "./industry-config";
import { stripUndefined } from "./text-utils";
import { sanitizeJsonCv, validateWriterOutput } from "./data-integrity";
import type { JsonProfile } from "@/lib/validations/cv.schema";
import type { JsonStrategy } from "./analyst";
import type { Domain } from "./industry-config";
import type { Logger } from "../infrastructure/logging/logger";

/* ═══════════════════════════════════════════════════════════════════════════
   WRITER AGENT — Two-State System

   MAIN_STATE:   Write CV from scratch (JsonProfile + JsonStrategy → JsonCv + Markdown)
   REFINE_STATE:  Apply user instruction to existing CV, or sync JsonCv ↔ Markdown

   Both modes enforce:
     • Metric Freeze (no invented numbers/percentages)
     • Expansion Limit (max 1 sentence / 20 words per entry)
     • Action Verbs Only (no generic verbs)
     • Section Preservation (never drop existing sections)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Types ───────────────────────────────────────────────────────────────── */

export interface JsonCv {
  name: string;
  title: string;
  /** All contact fields — dynamically rendered by templates */
  contact: Record<string, string | undefined>;
  summary: string;
  sections: Array<{
    type: string;
    title: string;
    entries: Array<{
      heading: string;
      subheading?: string;
      date?: string;
      bullets: string[];
      tags?: string[];
      description?: string;
    }>;
  }>;
  /** Languages — stored as both flat array (for quick access) and as a section */
  languages?: Array<string | { language: string; level?: string }>;
  /** Skills rendered SEPARATELY by templates — NOT duplicated in sections */
  skills: { categories: Array<{ name: string; items: string[] }> };
  metadata: {
    targetRole: string;
    tone: string;
    emphasis: string[];
    layoutDirectives?: {
      sectionOrder: string[];
      topSkills: string[];
      emphasisColor: string;
    };
  };
}

export interface WriterResult {
  markdown: string;
  jsonCv: JsonCv;
  title: string;
}

/** Discriminated input for two-state dispatch */
export interface WriterMainInput {
  mode: "main";
  profile: JsonProfile;
  strategy: JsonStrategy;
  jobAdvert: string;
  title: string;
  domain?: Domain;
}

export interface WriterRefineInput {
  mode: "refine";
  currentJsonCv: JsonCv;
  currentMarkdown: string;
  instruction: string;
  title: string;
  domain?: Domain;
}

export type WriterInput = WriterMainInput | WriterRefineInput;

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC API — runWriter dispatches to the correct state handler
   ═══════════════════════════════════════════════════════════════════════════ */

export async function runWriter(
  input: WriterInput, parentLog: Logger,
  onTokens?: TokenReporter
): Promise<WriterResult> {
  if (input.mode === "main") {
    const log = parentLog.child({ agent: "WRITER" });
    log.info("WRITER", "Starting main CV generation");
    return runWriterMain(input, log, onTokens);
  }
  const log = parentLog.child({ agent: "WRITER_REFINE" });
  log.info("WRITER_REFINE", "Starting refinement");
  return runWriterRefine(input, log, onTokens);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN_STATE — Write CV from scratch
   ═══════════════════════════════════════════════════════════════════════════ */

async function runWriterMain(input: WriterMainInput, log: Logger, onTokens?: TokenReporter): Promise<WriterResult> {
  const { profile, strategy, jobAdvert, title, domain } = input;

  const markdownCV = buildMarkdownFromJsonCv(profile, strategy, title);
  const jsonCv = buildJsonCv(profile, strategy, domain);

  try {
    const result = await generateAICV(jsonCv, markdownCV, jobAdvert, strategy, title, domain, log, onTokens);
    const sanitized = sanitizeJsonCv(result.jsonCv);
    const cleanMarkdown = stripUndefined(result.markdown);
    log.info("WRITER", "MAIN_STATE complete. Sections: " + sanitized.sections.map((s) => s.type).join(", "));
    return { markdown: cleanMarkdown, jsonCv: sanitized, title: sanitized.name || title };
  } catch (err) {
    log.warn("WRITER", "MAIN_STATE AI call failed: " + (err instanceof Error ? err.message : String(err)) + " → using deterministic fallback");
    return {
      markdown: markdownCV,
      jsonCv: sanitizeJsonCv(jsonCv),
      title: jsonCv.name || title,
    };
  }
}

/* ── Deterministic JsonCv builder (no AI) — used by MAIN_STATE fallback ──── */

function buildJsonCv(profile: JsonProfile, strategy: JsonStrategy, domain?: Domain): JsonCv {
  const safeArr = <T>(arr: T[] | undefined): T[] => arr ?? [];

  const keptExpIndices = new Set(safeArr(strategy.keep.experience).map((e) => e.index));
  const keptEduIndices = new Set(safeArr(strategy.keep.education).map((e) => e.index));
  const keptCertIndices = new Set(safeArr(strategy.keep.certifications).map((e) => e.index));
  const keptProjIndices = new Set(safeArr(strategy.keep.projects).map((e) => e.index));

  // Flatten additionalLinks into individual contact entries so templates render them natively
  // Deduplicate by URL: if a link URL matches an existing field (e.g. website), skip the duplicate
  const seenUrls = new Set<string>();
  const contact: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(profile.contact || {})) {
    if (key === "additionalLinks" && Array.isArray(value)) {
      for (const link of value as Array<{ label?: string; url?: string }>) {
        if (link.label && link.url) {
          const urlLower = link.url.toLowerCase().trim();
          if (!seenUrls.has(urlLower)) {
            seenUrls.add(urlLower);
            contact[link.label.toLowerCase().replace(/\s+/g, "_")] = link.url;
          }
        }
      }
    } else if (typeof value === "string" && value.trim()) {
      const urlLower = value.toLowerCase().trim();
      if (!seenUrls.has(urlLower)) {
        seenUrls.add(urlLower);
      }
      contact[key] = value;
    }
  }

  const keptExperience = safeArr(profile.experience).filter((_, i) => keptExpIndices.has(i));
  const keptEducation = safeArr(profile.education).filter((_, i) => keptEduIndices.has(i));
  const keptCertifications = safeArr(profile.certifications).filter((_, i) => keptCertIndices.has(i));
  const keptProjects = safeArr(profile.projects).filter((_, i) => keptProjIndices.has(i));

  const keptAwards = safeArr(strategy.keep.awards).map((a) => typeof a === "string" ? a : a.name ?? "");
  const keptPublications = safeArr(strategy.keep.publications).map((p) => typeof p === "string" ? p : p.name ?? "");
  const keptVolunteer = safeArr(strategy.keep.volunteer).map((v) => typeof v === "string" ? v : v.name ?? "");
  const keptInterests = safeArr(strategy.keep.interests).map((i) => typeof i === "string" ? i : i.name ?? "");
  const keptSkills = safeArr(strategy.keep.skills);

  // Build all sections — SKILLS EXCLUDED (rendered separately via cv.skills.categories)
  const allSections = [
    { type: "experience", title: "Professional Experience", entries: keptExperience.map((e) => ({ heading: e.role || "", subheading: e.company || "", date: `${e.startDate || ""} – ${e.endDate || ""}`, bullets: safeArr(e.achievements) })) },
    { type: "education", title: "Education", entries: keptEducation.map((e) => {
      const sub = [e.institution, e.field].filter(Boolean).join(" — ");
      const dateParts = [e.startDate, e.year].filter(Boolean);
      const date = dateParts.length > 1 ? `${dateParts[0]} – ${dateParts[dateParts.length - 1]}` : (e.year || "");
      const bullets = [e.grade ? `Grade: ${e.grade}` : "", e.details || ""].filter(Boolean);
      return { heading: e.degree || "", subheading: sub, date, bullets };
    }) },
    { type: "certifications", title: "Certifications", entries: keptCertifications.map((c) => ({
      heading: c.name || "",
      subheading: c.issuer || "",
      date: c.year ?? "",
      bullets: [],
      description: c.description || "",
    })) },
    { type: "projects", title: "Projects", entries: keptProjects.map((p) => ({ heading: p.name || "", subheading: "", bullets: [p.description || ""] })) },
    { type: "awards", title: "Awards & Honors", entries: keptAwards.map((a) => ({ heading: a, subheading: "", bullets: [] })) },
    { type: "publications", title: "Publications", entries: keptPublications.map((p) => ({ heading: p, subheading: "", bullets: [] })) },
    { type: "volunteer", title: "Volunteer Experience", entries: keptVolunteer.map((v) => ({ heading: v, subheading: "", bullets: [] })) },
    { type: "interests", title: "Interests", entries: keptInterests.map((i) => ({ heading: i, subheading: "", bullets: [] })) },
    { type: "languages", title: "Languages", entries: safeArr(profile.skills?.languages).map((l) => ({ heading: l, subheading: "", bullets: [] })) },
  ];

  // Structural compliance: sort by Analyst's layoutDirectives.sectionOrder
  const order = strategy.layoutDirectives?.sectionOrder ?? strategy.strategy.order ??
    ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests", "languages"];
  const orderMap = new Map(order.map((type, idx) => [type, idx]));
  const sortedSections = allSections
    .filter((s) => s.entries.length > 0)
    .sort((a, b) => {
      const aIdx = orderMap.get(a.type) ?? 999;
      const bIdx = orderMap.get(b.type) ?? 999;
      return aIdx - bIdx;
    });

  return {
    name: profile.name || "",
    title: profile.title || "",
    contact,
    summary: profile.summary || "",
    sections: sortedSections.filter((s) => s.type !== "summary"),
    skills: { categories: buildSkillCategories(keptSkills, domain) },
    metadata: {
      targetRole: strategy.strategy.emphasis[0] || "",
      tone: strategy.strategy.tone,
      emphasis: safeArr(strategy.strategy.emphasis),
      layoutDirectives: strategy.layoutDirectives ?? {
        sectionOrder: order,
        topSkills: safeArr(strategy.strategy.emphasis).slice(0, 5),
        emphasisColor: "#3182ce",
      },
    },
  };
}

function buildSkillCategories(rawSkills: string[], domain?: Domain): Array<{ name: string; items: string[] }> {
  const categories: Record<string, string[]> = {};
  for (const skill of rawSkills) {
    const cat = classifySkill(skill, domain);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(skill);
  }
  const cats = Object.entries(categories).map(([name, items]) => ({ name, items }));
  return cats.length ? cats : [{ name: "Skills", items: rawSkills }];
}

/* ── Restoration helpers (REFINE_STATE) ──────────────────────────────────── */
/** Count total skill items across all categories */
function countSkillItems(cv: Record<string, unknown>): number {
  const skills = cv.skills as { categories?: Array<{ items?: unknown[] }> } | undefined;
  if (!skills?.categories?.length) return 0;
  return skills.categories.reduce((sum, cat) => sum + (cat.items?.length ?? 0), 0);
}

/** Get entries array for a given section type */
function getSectionEntries(cv: Record<string, unknown>, sectionType: string): Array<unknown> {
  const sections = cv.sections as Array<{ type: string; entries?: unknown[] }> | undefined;
  if (!sections?.length) return [];
  const section = sections.find((s) => s.type === sectionType);
  return section?.entries ?? [];
}

/** Restore a section from baseCv into targetCv */
function restoreSection(targetCv: Record<string, unknown>, baseCv: Record<string, unknown>, sectionType: string) {
  const targetSections = targetCv.sections as Array<{ type: string; entries: unknown[]; title: string }> | undefined;
  const baseSections = baseCv.sections as Array<{ type: string; entries: unknown[]; title: string }> | undefined;
  if (!baseSections?.length) return;
  const baseSection = baseSections.find((s) => s.type === sectionType);
  if (!baseSection) return;
  if (!Array.isArray(targetSections)) {
    targetCv.sections = [baseSection];
    return;
  }
  const existingIdx = targetSections.findIndex((s) => s.type === sectionType);
  if (existingIdx >= 0) {
    targetSections[existingIdx] = JSON.parse(JSON.stringify(baseSection));
  } else {
    targetSections.push(JSON.parse(JSON.stringify(baseSection)));
  }
}

/* ── AI-powered rephrasing (MAIN_STATE) ──────────────────────────────────── */

async function generateAICV(baseJsonCv: JsonCv, baseMarkdown: string, jobAdvert: string, strategy: JsonStrategy, title: string, domain: Domain | undefined, log: Logger, onTokens?: TokenReporter): Promise<WriterResult> {
  const systemRules = buildWriterSystemRules();
  const domainInstruction = domain && domain !== "unknown" ? `
[DOMAIN CONTEXT: ${domain}]
Use ${domain}-specific terminology. Match tone to ${domain} industry standards.` : "";

  const systemPrompt = `You are a Content Refiner — NOT a copywriter. Your job is to REPHRASE existing content to be more impactful. You NEVER invent new data.

${systemRules}

You receive a pre-built CV (jsonCv + markdown). Your job:
1. Rephrase bullet points to be more impactful (PRECISE action verbs, stronger language)
2. Rewrite the summary to better target the job advert (qualitative only — no numbers)
3. Maintain the EXACT same structure: same sections, same entries, same dates, same company names
4. Follow the Analyst's layoutDirectives for section ordering
5. Output improved jsonCv and matching markdown

CRITICAL: The jsonCv has TWO places for skills:
- 'jsonCv.sections[]' — contains experience, education, certifications, projects, awards, etc.
- 'jsonCv.skills.categories[]' — contains skill categories (Technical, Soft, Languages, Tools). You MUST preserve this field exactly as-is. Do NOT drop skills.categories.

DATA FIDELITY (expanded schema):
- Preserve education field (faculty/area of study), startDate, and grade/GPA in every entry.
- Preserve certification descriptions in bullets.
- Preserve all additionalLinks (GitHub, Kaggle, Portfolio, etc.) in contact.

STRICT EXPANSION LIMIT:
- Any contextual expansion must NOT exceed ONE additional sentence per entry.
- Any added context must stay under 20 words of new text per entry.
- Clarify a task ONLY when the original description implies the use of specific skills required by the Job Ad.
- Do NOT implement far-fetched or "forced" professional associations.

METRIC FREEZE:
- NEVER insert any numerical value, percentage, dollar amount, team size, or KPI not explicitly stated in the source JSON.
- "Led the team" with no number → cannot become "Led a team of 12 people".
- Use qualitative language only when no metrics exist in source.

ACTION VERBS ONLY:
- Replace ALL generic verbs with precise, high-impact action verbs.
- FORBIDDEN: "Assisted", "Helped", "Worked on", "Responsible for", "Involved in", "Participated in".
- REQUIRED: "Coordinated", "Developed", "Led", "Architected", "Spearheaded", "Streamlined".

ABSOLUTE RULES:
- NEVER change company names, job titles, dates, or degree names
- NEVER remove sections or entries
- NEVER invent achievements, metrics, or certifications
- NEVER add more than 20 words of new text per entry
- EVERY jsonCv.sections entry MUST have "bullets" as an array (empty [] allowed)
- The markdown and jsonCv must have IDENTICAL content${domainInstruction}`;

  const userPrompt = `## JOB ADVERTISEMENT
${jobAdvert.substring(0, 3000)}

## STRATEGY GUIDANCE (tone & emphasis only — NOT data)
Tone: ${strategy.strategy.tone}
Emphasis: ${JSON.stringify(strategy.strategy.emphasis)}
Custom Rules: ${JSON.stringify(strategy.strategy.customRules)}

## LAYOUT DIRECTIVES (MUST follow)
Section Order: ${JSON.stringify(strategy.layoutDirectives?.sectionOrder ?? strategy.strategy.order)}
Top Skills: ${JSON.stringify(strategy.layoutDirectives?.topSkills ?? strategy.strategy.emphasis.slice(0, 5))}
Emphasis Color: ${strategy.layoutDirectives?.emphasisColor ?? "#3182ce"}

## PRE-BUILT CV (rephrase and improve — do NOT change structure or data)

### Markdown:
${baseMarkdown.substring(0, 4000)}

### JsonCv:
${JSON.stringify(baseJsonCv, null, 2).substring(0, 5000)}

## YOUR TASK

Return a JSON object with exactly two fields. Keep ALL the same section types, entry headings, subheadings, and dates. Only rephrase bullets and summary. Follow the layoutDirectives for section ordering.

STRICT EXPANSION: No more than 1 additional sentence per entry. Max 20 new words per entry.
METRIC FREEZE: No invented numbers, percentages, or dollar amounts.
ACTION VERBS: Replace generic verbs with precise action verbs.

{
  "markdown": "the improved markdown CV",
  "jsonCv": { the improved JSON — same structure, rephrased bullets, follows layoutDirectives }
}`;

  const response = await queryOllama({ prompt: userPrompt, system: systemPrompt, model: "qwen3", temperature: 0.3, unloadAfter: true, log, onTokens });
  const rawText = typeof response === "string" ? response : JSON.stringify(response);
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("[WRITER] No JSON found in AI response");
  // Tiered sanitization: control chars (\x00-\x1f) are illegal inside JSON string literals.
  // Try raw first (AI may have properly escaped them), then strip all control chars on failure.
  let result: { markdown: string; jsonCv: JsonCv };
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch {
    const cleaned = jsonMatch[0].replace(/[\x00-\x1f]/g, ""); // strip ALL 0x00-0x1f
    result = JSON.parse(cleaned);
  }
  if (!result.markdown || !result.jsonCv) throw new Error("[WRITER] AI response missing markdown or jsonCv");

  // ── Restore skills if AI dropped or reduced them ──
  const baseSkillItems = countSkillItems(baseJsonCv);
  const resultSkillItems = countSkillItems(result.jsonCv);
  if (resultSkillItems < baseSkillItems) {
    log.warn("WRITER", `AI reduced skills (${resultSkillItems} vs ${baseSkillItems} items) — restoring from base JsonCv`);
    result.jsonCv.skills = JSON.parse(JSON.stringify(baseJsonCv.skills));
  }

  // ── Restore interests if AI dropped them ──
  const baseInterests = getSectionEntries(baseJsonCv, "interests");
  const resultInterests = getSectionEntries(result.jsonCv, "interests");
  if (baseInterests.length > 0 && resultInterests.length < baseInterests.length) {
    log.warn("WRITER", `AI reduced interests (${resultInterests.length} vs ${baseInterests.length}) — restoring`);
    restoreSection(result.jsonCv, baseJsonCv, "interests");
  }

  // ── Restore languages if AI dropped them ──
  const baseLangs = getSectionEntries(baseJsonCv, "languages");
  const resultLangs = getSectionEntries(result.jsonCv, "languages");
  if (baseLangs.length > 0 && resultLangs.length < baseLangs.length) {
    log.warn("WRITER", `AI reduced languages (${resultLangs.length} vs ${baseLangs.length}) — restoring`);
    restoreSection(result.jsonCv, baseJsonCv, "languages");
  }

  // Restore metadata/layoutDirectives if AI dropped them
  if (!result.jsonCv.metadata?.layoutDirectives && baseJsonCv.metadata?.layoutDirectives) {
    result.jsonCv.metadata = { ...result.jsonCv.metadata, layoutDirectives: JSON.parse(JSON.stringify(baseJsonCv.metadata.layoutDirectives)) };
  }

  // Restore dates, subheadings, descriptions that the AI may have dropped from entries
  for (const section of result.jsonCv.sections || []) {
    const baseSection = baseJsonCv.sections.find((s) => s.type === section.type);
    if (baseSection && section.entries) {
      for (let i = 0; i < section.entries.length; i++) {
        const baseEntry = baseSection.entries[i];
        if (!baseEntry) continue;
        const entry = section.entries[i];
        if (!entry.date && baseEntry.date) {
          entry.date = baseEntry.date;
        }
        if (!entry.subheading && baseEntry.subheading) {
          entry.subheading = baseEntry.subheading;
        }
        if (!entry.description && (baseEntry as Record<string, unknown>).description) {
          (entry as Record<string, unknown>).description = (baseEntry as Record<string, unknown>).description;
        }
      }
    }
  }

  validateWriterOutput(result);
  return { markdown: result.markdown, jsonCv: result.jsonCv, title: result.jsonCv.name || title };
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFINE_STATE — Apply user instruction or sync JsonCv ↔ Markdown
   ═══════════════════════════════════════════════════════════════════════════ */

async function runWriterRefine(input: WriterRefineInput, log: Logger, onTokens?: TokenReporter): Promise<WriterResult> {
  const { currentJsonCv, currentMarkdown, instruction, title, domain } = input;

  // Step 1: Always sync JsonCv from currentMarkdown first (captures Write Text edits)
  log.info("WRITER_REFINE", "Syncing JsonCv from current markdown");
  const synced = attemptMarkdownSync(currentJsonCv, currentMarkdown, log);
  let workingJsonCv = sanitizeJsonCv(synced);
  let workingMarkdown = currentMarkdown;

  // Step 2: If instructions are present, split them into atomic commands and apply sequentially.
  // This makes refine robust when the user writes e.g.:
  // "remove hobbies; add English C1; add GitHub ...; rewrite summary ..."
  if (instruction && instruction.trim()) {
    const commands = parseRefinementCommands(instruction);
    log.info("WRITER_REFINE", `Applying ${commands.length} refinement command(s)`);

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      log.info("WRITER_REFINE", `Command ${i + 1}/${commands.length}: "${command.substring(0, 80)}..."`);
      try {
        const refined = await applyRefinementAI(workingJsonCv, workingMarkdown, command, title, domain, log, onTokens);
        workingJsonCv = sanitizeJsonCv(refined.jsonCv);
        workingMarkdown = stripUndefined(refined.markdown);
      } catch (err) {
        log.warn("WRITER_REFINE", "Command AI refinement failed, using text-edit fallback: " + (err instanceof Error ? err.message : String(err)));
        workingMarkdown = applyMarkdownEdit(workingMarkdown, command, log);
        workingJsonCv = sanitizeJsonCv(attemptMarkdownSync(workingJsonCv, workingMarkdown, log, command));
      }
    }

    // Final sync guarantees Markdown-driven edits are reflected in JsonCv after all commands.
    const finalJsonCv = sanitizeJsonCv(attemptMarkdownSync(workingJsonCv, workingMarkdown, log, instruction));
    return { markdown: workingMarkdown, jsonCv: finalJsonCv, title: finalJsonCv.name || title };
  }

  // No instruction — return synced result (Write Text only)
  return { markdown: workingMarkdown, jsonCv: workingJsonCv, title: workingJsonCv.name || title };
}


/**
 * Split a free-form refine instruction into atomic commands.
 * Supports bullets, numbered lists, semicolons, and common English/Italian connectors.
 * URLs are protected so `https://...` is not broken while splitting.
 */
function parseRefinementCommands(instruction: string): string[] {
  const placeholders: string[] = [];

  const protect = (text: string) =>
    text
      .replace(/https?:\/\/\S+/gi, (match) => {
        const token = `__PLACEHOLDER_${placeholders.length}__`;
        placeholders.push(match);
        return token;
      })
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, (match) => {
        const token = `__PLACEHOLDER_${placeholders.length}__`;
        placeholders.push(match);
        return token;
      });

  const restore = (text: string) =>
    text.replace(/__PLACEHOLDER_(\d+)__/g, (_, idx) => placeholders[Number(idx)] ?? "");

  const actionWords = [
    // English
    "add", "include", "insert", "append",
    "remove", "delete", "drop", "eliminate", "cut", "omit",
    "rewrite", "change", "update", "replace", "make", "improve", "edit",

    // Italian
    "aggiungi", "inserisci", "includi",
    "rimuovi", "elimina", "cancella", "togli", "ometti",
    "riscrivi", "modifica", "aggiorna", "sostituisci", "rendi", "migliora"
  ];

  const actionPattern = actionWords.join("|");
  const protectedText = protect(instruction);

  const normalized = protectedText
    .replace(/\r\n/g, "\n")

    // Bullet / numbered lists
    .replace(/\n\s*(?:[-*•]|\d+[.)])\s*/g, "\n")

    // Semicolon separators
    .replace(/;+/g, "\n")

    // Textual connectors before a new action
    .replace(
      new RegExp(
        `\\s+(?:and then|then|also|plus|in addition|besides|e poi|poi|inoltre|e anche|anche)\\s+(?=(?:${actionPattern})\\b)`,
        "gi"
      ),
      "\n"
    )

    // "and/e" only when followed by a new action
    .replace(
      new RegExp(`\\s+(?:and|e)\\s+(?=(?:${actionPattern})\\b)`, "gi"),
      "\n"
    )

    // Period separator ONLY when followed by a new action
    .replace(
      new RegExp(`\\.\\s+(?=(?:${actionPattern})\\b)`, "gi"),
      ".\n"
    );

  const commands = normalized
    .split(/\n+/)
    .map((part) =>
      restore(
        part
          .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
          .trim()
      )
    )
    .filter((part) => part.length > 0);

  return commands.length > 0 ? commands : [instruction.trim()];
}

/** When no instruction: parse Markdown and sync structured JsonCv to match. */
function syncJsonCvToMarkdown(jsonCv: JsonCv, markdown: string, title: string, log: Logger): WriterResult {
  log.info("WRITER_REFINE", "Syncing JsonCv to markdown (no instruction)");
  // Extract sections from markdown and update JsonCv
  const synced = attemptMarkdownSync(jsonCv, markdown, log);
  const validated = sanitizeJsonCv(synced);
  return { markdown, jsonCv: validated, title: validated.name || title };
}

/** Attempt to extract section data from Markdown and sync into JsonCv. */
function attemptMarkdownSync(jsonCv: JsonCv, markdown: string, log: Logger, instruction?: string): JsonCv {
  const cv = JSON.parse(JSON.stringify(jsonCv)) as JsonCv;

  // Extract summary from markdown (text between ## Summary and next ##)
  const summaryMatch = markdown.match(/##\s*(?:Professional\s+)?Summary\s*\n\n?([\s\S]*?)(?=\n##\s|\n#{3,}\s|$)/i);
  if (summaryMatch) cv.summary = summaryMatch[1].trim();

  // Scan markdown for present section headings
  const presentSectionTypes = new Set<string>();
  const sectionRegex = /(?:##\s*(.+)|\*\*(.+)\*\*)\s*\n/g;
  let match;
  while ((match = sectionRegex.exec(markdown)) !== null) {
    const header = (match[1] || match[2] || "").trim().toLowerCase();
    // Map common header names to section types
    const typeMap: Record<string, string> = {
      "professional experience": "experience", "experience": "experience", "work experience": "experience",
      "education": "education", "academic": "education", "academic background": "education",
      "skills": "skills", "core competencies": "skills", "technical skills": "skills",
      "certifications": "certifications", "certification": "certifications", "licenses": "certifications",
      "projects": "projects", "project": "projects", "personal projects": "projects",
      "awards": "awards", "honors": "awards", "awards & honors": "awards", "awards and honors": "awards",
      "publications": "publications", "publication": "publications", "papers": "publications",
      "volunteer": "volunteer", "volunteer experience": "volunteer", "volunteering": "volunteer", "volunteers": "volunteer",
      "interests": "interests", "hobbies": "interests", "personal interests": "interests",
      "languages": "languages", "language": "languages", "linguistic skills": "languages",
      "summary": "summary", "professional summary": "summary",
      "contact": "contact", "contact info": "contact", "contact information": "contact",
    };
    for (const [key, type] of Object.entries(typeMap)) {
      if (header.includes(key)) {
        presentSectionTypes.add(type);
        break;
      }
    }
  }

  log.info("WRITER_REFINE", "Markdown scan detected sections: " + [...presentSectionTypes].join(", "));
  log.info("WRITER_REFINE", "Existing JsonCv sections: " + cv.sections.map((s) => s.type).join(", "));

  // ── Section removal policy ──
  // By default, PRESERVE all existing sections. Only remove sections when
  // the user EXPLICITLY asks to remove/delete/drop them. This prevents
  // designer-only instructions (e.g. "make certifications as card") from
  // accidentally deleting content sections like Languages.
  const lowerInstruction = (instruction || "").toLowerCase();
  const explicitlyRequestedRemoval = /\b(remove|delete|drop|eliminate|get rid of|cut|omit)\b/i.test(lowerInstruction);

  if (explicitlyRequestedRemoval) {
    // User explicitly asked to remove something — parse which sections
    const removalTargets = new Set<string>();
    const removalAliases: Record<string, string[]> = {
      experience: ["experience", "work experience", "professional experience", "experiences"],
      education: ["education", "studies", "academic", "school"],
      skills: ["skills", "competencies", "technical skills"],
      certifications: ["certifications", "certification", "certificates", "certs"],
      projects: ["projects", "project"],
      awards: ["awards", "award", "honors", "honours"],
      publications: ["publications", "publication", "papers"],
      volunteer: ["volunteer", "volunteering", "volunteers"],
      interests: ["interests", "interest", "hobbies"],
      languages: ["languages", "language", "linguistic skills"],
      summary: ["summary", "professional summary"],
      contact: ["contact", "contact info", "contact information"],
    };

    for (const [sectionType, aliases] of Object.entries(removalAliases)) {
      const removePattern = new RegExp(`\\b(remove|delete|drop|eliminate|get\\s+rid\\s+of|cut|omit)\\b.*\\b(${aliases.join("|")})\\b|\\b(${aliases.join("|")})\\b.*\\b(remove|delete|drop|eliminate|get\\s+rid\\s+of|cut|omit)\\b`, "i");
      if (removePattern.test(lowerInstruction)) {
        removalTargets.add(sectionType);
      }
    }

    if (removalTargets.size > 0) {
      const toRemove = cv.sections.filter((s) => removalTargets.has(s.type));
      if (toRemove.length > 0) {
        const removedTypes = toRemove.map((s) => s.type);
        cv.sections = cv.sections.filter((s) => !removalTargets.has(s.type));
        if (!cv.metadata) cv.metadata = {};
        cv.metadata.removedSections = [...(cv.metadata.removedSections ?? []), ...removedTypes];
        log.info("WRITER_REFINE", "Explicitly removed sections: " + removedTypes.join(", "));
      }
    }
  }

  // Preserve any existing section that was not explicitly removed
  const preservedSections = cv.sections.filter((s) => !cv.metadata?.removedSections?.includes(s.type));
  log.info("WRITER_REFINE", "Preserved sections: " + preservedSections.map((s) => s.type).join(", "));

  // Sync contact info from markdown
  // Contacts are written one per line: "key: value" — NEVER joined with " | "
  const contactSection = markdown.match(/(?:\*\*Contact:?\*\*|##\s*Contact)\s*\n\n?([\s\S]*?)(?=\n\*\*|\n##\s|$)/i);
  if (contactSection) {
    // Clear existing contacts to prevent accumulation across refinement passes
    const oldContact = { ...cv.contact };
    cv.contact = {};
    // Split by both newlines AND " | " (handles both old and new format)
    const rawLines = contactSection[1].split(/\n|\s*\|\s*/).filter((l) => l.trim());
    for (const line of rawLines) {
      const m = line.match(/^([A-Za-z][\w\s]+):\s*(.+)$/);
      if (m && !m[1].includes("-") && !m[1].includes("*")) {
        const key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
        const value = m[2].trim();
        // Sanity check: reject lines that look like skills or certifications
        if (value.includes(",") && value.length > 40 && !value.includes("http")) continue;
        // Deduplicate: skip if this exact key:value already exists
        if (cv.contact[key] === value) continue;
        cv.contact[key] = value;
      }
    }
    // If parsing produced nothing, restore old contacts (defensive)
    if (Object.keys(cv.contact).length === 0) {
      cv.contact = oldContact;
    }
  }

  // Sync certifications from markdown (extract bullet lines from Certifications section)
  const certMatch = markdown.match(/##\s*Certifications\s*\n\n?([\s\S]*?)(?=\n##\s|$)/i);
  if (certMatch) {
    const certSection = cv.sections.find((s) => s.type === "certifications");
    if (certSection) {
      const certBullets = certMatch[1].split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter((l) => l.length > 3);
      certSection.entries = certBullets.map((b) => {
        const parts = b.split(/\s*[—–-]\s*/);
        return { heading: parts[0], subheading: parts[1] || "", date: parts[2] || "", bullets: [] };
      });
    }
  }

  // Sync languages from markdown (extract from Languages section)
  // Pattern: "- Italian — Native" or "- English (B2)" or "- French - Fluent"
  const langMatch = markdown.match(/(?:\*\*Languages:?\*\*|##\s*Languages)\s*\n\n?([\s\S]*?)(?=\n\*\*|\n##\s|$)/i);
  if (langMatch) {
    const langLines = langMatch[1].split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter((l) => l.length > 0);
    const langEntries = langLines.map((line) => {
      // Match "Language — Proficiency" or "Language - Proficiency" or "Language (Proficiency)"
      const parts = line.match(/^([^(—–-]+)(?:\s*[—–-]\s*|\s*\(\s*)([^)]+)?/);
      if (parts) {
        return { heading: parts[1].trim(), subheading: (parts[2] || "").trim(), bullets: [] as string[] };
      }
      return { heading: line, subheading: "", bullets: [] as string[] };
    }).filter((e) => e.heading.length > 0);

    if (langEntries.length > 0) {
      const existingLangIdx = cv.sections.findIndex((s) => s.type === "languages");
      if (existingLangIdx >= 0) {
        cv.sections[existingLangIdx].entries = langEntries;
      } else {
        cv.sections.push({ type: "languages", title: "Languages", entries: langEntries });
      }
      log.info("WRITER_REFINE", `Synced languages from markdown: ${langEntries.length} language(s)`);
    }
  }

  // Preserve layoutDirectives during sync
  if (!cv.metadata) cv.metadata = { targetRole: "", tone: "professional", emphasis: [] };

  return cv;
}

/** Detects if the user instruction explicitly requests section removal. Returns array of section types to remove. */
/** Map of common user synonyms/aliases to canonical section type names.
 *  Users often say "hobby" instead of "interests", "cert" instead of
 *  "certifications", etc. This mapping bridges the gap.                */
const buildAliasMap = () => {
  const entries: Array<[string, string]> = [
    // interests
    ["hobby", "interests"],
    ["hobbies", "interests"],

    // experience
    ["job", "experience"],
    ["jobs", "experience"],
    ["work", "experience"],

    // contact
    ["contact info", "contact"],
    ["contact details", "contact"],
    ["phone", "contact"],
    ["email", "contact"],
    ["address", "contact"],
    ["location", "contact"],
    ["linkedin", "contact"],
    ["website", "contact"],

    // skills
    ["skill", "skills"],
    ["skills", "skills"],
    ["competency", "skills"],
    ["competencies", "skills"],
  ];

  return Object.fromEntries(
    Array.from(new Map(entries)) // 🔥 deduplica automaticamente
  );
};

const SECTION_ALIASES = buildAliasMap();

function parseRemovalInstruction(instruction: string): string[] {
  const lower = instruction.toLowerCase();
  const removals: string[] = [];
  
  // Known section types that can be removed
  const sectionTypes = ["experience", "education", "skills", "certifications", "projects", "awards", "publications", "volunteer", "interests", "languages", "summary", "contact"];
  
  // Phase 1: Check for aliases (e.g., "hobby" → "interests")
  // Look for "remove hobby" patterns where the noun is an alias
  const actionPattern = `(?:remove|delete|drop|eliminate|get rid of|cut|omit|rimuovi|elimina|cancella|togli|ometti)`;
  for (const [alias, canonical] of Object.entries(SECTION_ALIASES)) {
    const regex = new RegExp(`\\b${actionPattern}\\s+(?:the\\s+|la\\s+|il\\s+|i\\s+|gli\\s+|le\\s+)?(?:section\\s+|sezione\\s+)?${alias}\\b`, "i");
    if (regex.test(lower) && !removals.includes(canonical)) {
      removals.push(canonical);
    }
  }
  
  // Phase 2: Check for exact section type names
  // Pattern: "remove/delete/drop/eliminate/get rid of [the] X [section]"
  for (const type of sectionTypes) {
    const regex = new RegExp(`\\b${actionPattern}\\s+(?:the\\s+|la\\s+|il\\s+|i\\s+|gli\\s+|le\\s+)?(?:section\\s+|sezione\\s+)?${type}(?:\\s+section|\\s+sezione)?\\b`, "i");
    if (regex.test(lower) && !removals.includes(type)) {
      removals.push(type);
    }
  }
  
  // Phase 3: Also check plural forms of canonical types
  const pluralMap: Record<string, string> = {
    "awards": "awards", "certifications": "certifications", "projects": "projects",
    "publications": "publications", "interests": "interests", "languages": "languages",
  };
  for (const [plural, singular] of Object.entries(pluralMap)) {
    const regex = new RegExp(`\\b${actionPattern}\\s+(?:the\\s+|la\\s+|il\\s+|i\\s+|gli\\s+|le\\s+)?(?:section\\s+|sezione\\s+)?${plural}\\b`, "i");
    if (regex.test(lower) && !removals.includes(singular)) {
      removals.push(singular);
    }
  }
  
  return removals;
}

/** Removes specified sections from JsonCv and Markdown. */
function removeSectionsFromCv(cv: JsonCv, markdown: string, sectionsToRemove: string[]): { cv: JsonCv; markdown: string } {
  let newMarkdown = markdown;
  
  for (const sectionType of sectionsToRemove) {
    // Remove from jsonCv.sections
    cv.sections = cv.sections.filter((s) => s.type !== sectionType);
    
    // Remove from markdown — match ## SectionName or **SectionName**
    // Use a regex that removes the section header and all content until the next section
    const sectionHeaders = [
      `##\\s*${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}`,
      `\\*\\*${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}`,
    ];
    for (const headerPattern of sectionHeaders) {
      const regex = new RegExp(`(${headerPattern}[^\\n]*\\n\\n?[\\s\\S]*?)(?=\\n##\\s|\\n\\*\\*\\*|$)`, "i");
      newMarkdown = newMarkdown.replace(regex, "");
    }
    
    // Also handle skills specially (it's in jsonCv.skills, not sections)
    if (sectionType === "skills") {
      cv.skills = { categories: [] };
    }
    // Handle contact specially
    if (sectionType === "contact") {
      cv.contact = {};
      newMarkdown = newMarkdown.replace(/(?:\*\*Contact:?\*\*|##\s*Contact)\s*\n\n?[\s\S]*?(?=\n\*\*|\n##\s|$)/i, "");
    }
    // Handle summary specially (not in sections)
    if (sectionType === "summary") {
      newMarkdown = newMarkdown.replace(/(?:##\s*Summary|\*\*Summary:?\*\*)\s*\n\n?[\s\S]*?(?=\n##\s|\n\*\*\*|$)/i, "");
    }
  }
  
  // Clean up multiple consecutive blank lines
  newMarkdown = newMarkdown.replace(/\n{3,}/g, "\n\n");
  
  return { cv, markdown: newMarkdown.trim() };
}

/** AI-powered refinement with instruction. */
async function applyRefinementAI(currentJsonCv: JsonCv, currentMarkdown: string, instruction: string, title: string, domain: Domain | undefined, log: Logger, onTokens?: TokenReporter): Promise<WriterResult> {
  // Pre-process: detect and apply user-requested section removals BEFORE AI call
  const sectionsToRemove = parseRemovalInstruction(instruction);
  let jsonCv = JSON.parse(JSON.stringify(currentJsonCv)) as JsonCv;
  let markdown = currentMarkdown;
  const explicitlyRemoved = new Set<string>();

  if (sectionsToRemove.length > 0) {
    log.info("WRITER_REFINE", "User requested removal of sections: " + sectionsToRemove.join(", "));
    const result = removeSectionsFromCv(jsonCv, markdown, sectionsToRemove);
    jsonCv = result.cv;
    markdown = result.markdown;
    for (const s of sectionsToRemove) explicitlyRemoved.add(s);

    // If removal was the ONLY thing requested, return early (no need for AI)
    const cleanInstruction = instruction.toLowerCase().replace(/(?:remove|delete|drop|eliminate|get rid of|cut|omit|rimuovi|elimina|cancella|togli|ometti)\s+(?:the\s+|la\s+|il\s+|i\s+|gli\s+|le\s+)?[\wÀ-ÿ]+(?:\s+section|\s+sezione)?/gi, "").trim();
    if (!cleanInstruction || cleanInstruction.length < 10) {
      log.info("WRITER_REFINE", "Removal-only instruction, skipping AI call");
      return { markdown, jsonCv: sanitizeJsonCv(jsonCv), title: jsonCv.name || title };
    }
  }
  
  const systemRules = buildRefinementSystemRules();
  const domainInstruction = domain && domain !== "unknown" ? `
[DOMAIN CONTEXT: ${domain}]` : "";

  const systemPrompt = `You are a CV Refiner. The user has provided a specific instruction to modify their CV.
${systemRules}

STRICT EXPANSION LIMIT (applies even more strictly in refinement):
- Max 1 additional sentence per entry. Max 20 new words per entry.
- NEVER add numbers/percentages/KPIs not in the original.

SECTION REMOVAL — CRITICAL:
- If the user EXPLICITLY asks to remove, delete, drop, or eliminate a section (e.g. "remove awards", "delete volunteer section", "get rid of interests"), you MUST comply and remove it from BOTH jsonCv.sections and the Markdown.
- If the user does NOT ask to remove anything, preserve ALL sections and entries exactly.
- NEVER remove anything silently. Only remove when the user explicitly requests it.

If the instruction asks to ADD a contact (e.g. GitHub, website, portfolio, Kaggle):
- Add it to jsonCv.contact as a new key-value pair.
- Update the Markdown to include it in the contact section.

If the instruction asks to ADD a certification description:
- Update the certification entry's bullets with the new description.
- Ensure both jsonCv and Markdown reflect the addition.

FIELD PRESERVATION (new data model):
- ALWAYS preserve education field (faculty/area of study), startDate, and grade/GPA when present.
- ALWAYS preserve certification descriptions in bullets.
- ALWAYS preserve additionalLinks (GitHub, Kaggle, Portfolio, etc.) in contact.

If you are unsure about a change, prefer the conservative option (minimal edit).${domainInstruction}`;

  const userPrompt = `## USER INSTRUCTION (apply precisely)
${instruction}

## CURRENT JSONCV
${JSON.stringify(jsonCv, null, 2).substring(0, 6000)}

## CURRENT MARKDOWN
${markdown.substring(0, 4000)}

## YOUR TASK

Apply the user's instruction to BOTH the Markdown and the JsonCv.
Return a JSON object with exactly two fields:

{
  "markdown": "the updated markdown CV",
  "jsonCv": { the updated JSON — same structure as input, with instruction applied }
}

RULES:
- Preserve ALL sections in jsonCv EXCEPT those the user asked to remove.
- NEVER re-add a section that was already removed.
- If adding a contact, add it to jsonCv.contact.
- If adding a certification description, add it to bullets.
- Do not invent metrics or numbers.
- Keep changes minimal and precise.`;

  const response = await queryOllama({ prompt: userPrompt, system: systemPrompt, model: "qwen3", temperature: 0.3, unloadAfter: true, log, onTokens });
  const rawText = typeof response === "string" ? response : JSON.stringify(response);
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("[WRITER] No JSON in refine response");
  const result = JSON.parse(jsonMatch[0]);
  if (!result.markdown || !result.jsonCv) throw new Error("[WRITER] Refine response missing fields");

  const sanitized = sanitizeJsonCv(result.jsonCv);

  // Validate section preservation — but NEVER restore sections the user explicitly asked to remove
  const originalTypes = new Set(currentJsonCv.sections.map((s) => s.type));
  const resultTypes = new Set(sanitized.sections.map((s) => s.type));
  const missing = [...originalTypes].filter((t) => !resultTypes.has(t) && !explicitlyRemoved.has(t));
  if (missing.length > 0) {
    log.warn("WRITER_REFINE", "Missing sections after AI refine, restoring: " + missing.join(", "));
    for (const type of missing) {
      const original = currentJsonCv.sections.find((s) => s.type === type);
      if (original) sanitized.sections.push(original);
    }
  }
  if (explicitlyRemoved.size > 0) {
    log.info("WRITER_REFINE", "Explicitly removed sections kept removed: " + [...explicitlyRemoved].join(", "));
  }

  // Preserve layoutDirectives
  if (!sanitized.metadata?.layoutDirectives && currentJsonCv.metadata?.layoutDirectives) {
    sanitized.metadata = { ...sanitized.metadata, layoutDirectives: currentJsonCv.metadata.layoutDirectives };
  }

  // Preserve contact additions
  for (const [key, value] of Object.entries(currentJsonCv.contact || {})) {
    if (value && !sanitized.contact[key]) {
      sanitized.contact[key] = value;
    }
  }

  log.info("WRITER_REFINE", "Refinement complete. Sections: " + sanitized.sections.map((s) => s.type).join(", "));
  return { markdown: stripUndefined(result.markdown), jsonCv: sanitized, title: sanitized.name || title };
}

/* ── Text-only fallback for refinement ────────────────────────────────────── */

function applyMarkdownEdit(markdown: string, instruction: string, log: Logger): string {
  const lower = instruction.toLowerCase();


  // ── Language additions ─────────────────────────────────────────────────
  // Patterns: "add languages: Italian native, English B2"
  //           "add language English B2"
  //           "add Italian native and English fluent"
  const langDirectiveMatch = instruction.match(/(?:add|aggiungi|inserisci)\s+(?:language[s]?|lingu[ae])\s*[:\s]\s*(.+)/i);
  const langSimpleMatch = instruction.match(/(?:add|aggiungi|inserisci)\s+(?:language|lingua)\s+(.+)/i);
  const langListMatch = langDirectiveMatch || langSimpleMatch;

  if (langListMatch || /\badd\b.*\b(italian|english|french|spanish|german|portuguese|chinese|japanese|russian|arabic|hindi|korean|dutch|polish|turkish|swedish|norwegian|danish|finnish|czech|hungarian|romanian|greek|hebrew|thai|vietnamese)\b/i.test(lower)) {
    // Parse individual languages from the instruction
    const langItems = parseLanguageInstruction(instruction);
    if (langItems.length > 0) {
      const langMarkdown = langItems.map((l) => `- ${l.language}${l.proficiency ? ` — ${l.proficiency}` : ""}`).join("\n");

      // If Languages section already exists, append to it
      if (/\*\*Languages\*\*|##\s*Languages/i.test(markdown)) {
        return markdown.replace(
          /(\*\*Languages:?\*\*|##\s*Languages)\s*\n\n?([\s\S]*?)(?=\n\*\*|\n##\s|$)/i,
          (match, header, content) => {
            const existing = content.trim();
            return `${header}\n\n${existing}${existing ? "\n" : ""}${langMarkdown}\n\n`;
          }
        );
      }

      // Otherwise append a new Languages section at the end
      log.info("WRITER_REFINE", `Adding Languages section via fallback: ${langItems.map((l) => l.language).join(", ")}`);
      return markdown.trim() + `\n\n**Languages**\n\n${langMarkdown}\n\n`;
    }
  }

  // ── Contact additions ──────────────────────────────────────────────────
  if (/(?:add|include|aggiungi|inserisci|includi)\s+(github|git|portfolio|website|sito|twitter|x|linkedin|email|phone|telefono)/i.test(lower)) {
    const contactType = instruction.match(/(?:add|include|aggiungi|inserisci|includi)\s+(?:my\s+|il\s+mio\s+|la\s+mia\s+)?([^\s]+)/i)?.[1] || "";
    const contactValue =
    instruction.match(/https?:\/\/[^\s]+/i)?.[0] ||
    instruction.match(/\b(?:github|linkedin)\.com\/[^\s]+/i)?.[0] ||
    instruction.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] ||
    instruction.match(/(?:\+?\d[\d\s-]{7,}\d)/i)?.[0] ||
    "";
    const normalizedContactValue =
      contactValue && !/^https?:\/\//i.test(contactValue) && /^(github|linkedin)\.com\//i.test(contactValue)
        ? `https://${contactValue}`
        : contactValue;
        
    if (contactType && normalizedContactValue && markdown.includes("**Contact**")) {
      return markdown.replace(
        /(\*\*Contact:?\*\*|## Contact)\s*\n\n?([\s\S]*?)(?=\n\*\*|\n##\s|$)/i,
        (match, header, content) => `${header}\n\n${content.trim()}\n${contactType}: ${normalizedContactValue}\n\n`
      );
    }
  }

  // ── Summary edits ──────────────────────────────────────────────────────
  if (/summary|headline|objective|riepilogo|sommario|profilo|presentazione/i.test(lower)) {
    const newSummary = instruction.replace(/.*(?:to\s+|make\s+|write\s+|use\s+)/i, "").trim();
    if (newSummary.length > 10 && markdown.includes("**Summary**")) {
      return markdown.replace(/(\*\*Summary:?\*\*)\s*\n\n?([\s\S]*?)(?=\n\*\*|\n##\s|$)/i, `**Summary**\n\n${newSummary}\n\n`);
    }
  }

  // Generic: append instruction as a comment
  log.warn("WRITER_REFINE", "No text-edit pattern matched, appending as comment");
  return markdown + `\n\n<!-- User request: ${instruction} -->\n`;
}

/** Parse language names and proficiencies from an instruction like "Italian native, English B2" */
function parseLanguageInstruction(instruction: string): Array<{ language: string; proficiency: string }> {
  const items: Array<{ language: string; proficiency: string }> = [];
  const seen = new Set<string>();

  // Pattern: "Language proficiency" pairs separated by commas or "and"
  // e.g. "Italian native, English B2, French fluent"
  // e.g. "Italian native and English B2"
  const pairPattern = /([A-Z][a-z]+)\s+(native|fluent|advanced|intermediate|basic|beginner|b1|b2|c1|c2|a1|a2|professional|conversational|mother\s*tongue)/gi;

  let m: RegExpExecArray | null;
  while ((m = pairPattern.exec(instruction)) !== null) {
    const lang = m[1];
    const prof = m[2].replace(/\s+/g, " ").trim();
    const key = lang.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ language: lang, proficiency: prof });
    }
  }

  // Fallback: if no proficiencies matched, just extract language names
  if (items.length === 0) {
    const langNames = instruction.match(/\b(Italian|English|French|Spanish|German|Portuguese|Chinese|Japanese|Russian|Arabic|Hindi|Korean|Dutch|Polish|Turkish|Swedish|Norwegian|Danish|Finnish|Czech|Hungarian|Romanian|Greek|Hebrew|Thai|Vietnamese)\b/gi);
    if (langNames) {
      for (const lang of langNames) {
        const key = lang.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          items.push({ language: lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase(), proficiency: "" });
        }
      }
    }
  }

  return items;
}

/* ── Markdown builder (deterministic, no AI) — MAIN_STATE fallback ───────── */

function buildMarkdownFromJsonCv(profile: JsonProfile, strategy: JsonStrategy, title: string): string {
  const safeArr = <T>(arr: T[] | undefined): T[] => arr ?? [];
  let md = `## ${profile.name || title}${profile.title ? ` — ${profile.title}` : ""}\n\n`;
  if (profile.contact) {
    const entries: string[] = [];
    const seen = new Set<string>();
    for (const [key, value] of Object.entries(profile.contact)) {
      if (key === "additionalLinks" && Array.isArray(value)) {
        for (const link of value as Array<{ label?: string; url?: string }>) {
          if (link.label && link.url) {
            const line = `${link.label}: ${link.url}`;
            if (!seen.has(line)) { seen.add(line); entries.push(line); }
          }
        }
      } else if (value && typeof value === "string" && value.trim()) {
        const line = `${key}: ${value}`;
        if (!seen.has(line)) { seen.add(line); entries.push(line); }
      }
    }
    // One contact per line — NEVER join with " | " (breaks round-trip parsing)
    if (entries.length) md += `**Contact**\n\n${entries.join("\n")}\n\n`;
  }
  if (profile.summary) md += `**Summary**\n\n${profile.summary}\n\n`;

  const order = strategy.layoutDirectives?.sectionOrder ?? strategy.strategy.order ?? ["experience", "education", "skills", "certifications", "projects", "awards", "publications", "volunteer", "interests"];

  for (const type of order) {
    switch (type) {
      case "experience": {
        const kept = safeArr(strategy.keep.experience);
        if (!kept.length) break;
        md += `**Experience**\n\n`;
        for (const e of kept) {
          const exp = safeArr(profile.experience).find((_, i) => i === e.index);
          if (!exp) continue;
          md += `### ${exp.role}${exp.company ? ` — ${exp.company}` : ""}\n${exp.startDate || ""} – ${exp.endDate || ""}${exp.location ? ` · ${exp.location}` : ""}\n\n`;
          if (exp.achievements?.length) {
            for (const a of exp.achievements) md += `- ${a}\n`;
            md += "\n";
          }
        }
        break;
      }
      case "education": {
        const kept = safeArr(strategy.keep.education);
        if (!kept.length) break;
        md += `**Education**\n\n`;
        for (const e of kept) {
          const edu = safeArr(profile.education).find((_, i) => i === e.index);
          if (!edu) continue;
          const parts = [edu.degree];
          if (edu.institution) parts.push(`— ${edu.institution}`);
          if (edu.field) parts.push(`in ${edu.field}`);
          const dateParts = [edu.startDate, edu.year].filter(Boolean);
          if (dateParts.length) parts.push(`(${dateParts.join(" – ")})`);
          if (edu.grade) parts.push(`[Grade: ${edu.grade}]`);
          md += `- ${parts.join(" ")}\n`;
        }
        md += "\n";
        break;
      }
      case "skills": {
        const skills = safeArr(strategy.keep.skills);
        if (!skills.length) break;
        const cats = buildSkillCategories(skills, undefined);
        md += `**Skills**\n\n`;
        for (const c of cats) md += `**${c.name}:** ${c.items.join(", ")}\n\n`;
        break;
      }
      case "certifications": {
        const kept = safeArr(strategy.keep.certifications);
        if (!kept.length) break;
        md += `**Certifications**\n\n`;
        for (const c of kept) {
          const cert = safeArr(profile.certifications).find((_, i) => i === c.index);
          if (!cert) continue;
          md += `- ${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ""}${cert.year ? ` (${cert.year})` : ""}${cert.description ? `: ${cert.description}` : ""}\n`;
        }
        md += "\n";
        break;
      }
      case "projects": {
        const kept = safeArr(strategy.keep.projects);
        if (!kept.length) break;
        md += `**Projects**\n\n`;
        for (const p of kept) {
          const proj = safeArr(profile.projects).find((_, i) => i === p.index);
          if (!proj) continue;
          md += `### ${proj.name}\n${proj.description || ""}${proj.technologies?.length ? ` · ${proj.technologies.join(", ")}` : ""}\n\n`;
        }
        break;
      }
      case "languages": {
        const langs = safeArr(profile.skills?.languages);
        if (!langs.length) break;
        md += `**Languages**\n\n`;
        for (const l of langs) md += `- ${l}\n`;
        md += "\n";
        break;
      }
      default: {
        // Awards, publications, volunteer, interests
        const keepKey = type as keyof typeof strategy.keep;
        const kept = safeArr(strategy.keep[keepKey]) as Array<{ index: number }>;
        if (!kept.length) break;
        const items = safeArr((profile as Record<string, unknown>)[type] as string[]);
        md += `**${type.charAt(0).toUpperCase() + type.slice(1)}**\n\n`;
        for (const k of kept) {
          const item = items[k.index];
          if (item) md += `- ${item}\n`;
        }
        md += "\n";
      }
    }
  }
  return md;
}

/* ── Backward-compatible exports ─────────────────────────────────────────── */

export { buildJsonCv as _buildJsonCv, buildMarkdownFromJsonCv as _buildMarkdownFromJsonCv };
