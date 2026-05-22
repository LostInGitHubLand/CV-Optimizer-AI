import { z } from "zod";
import { isOllamaAvailable, chatWithOllamaJSON } from "../infrastructure/ai/ollama";
import type { TokenReporter } from "../infrastructure/ai/ollama";
import { JsonProfileSchema, type JsonProfile } from "../../src/lib/validations/cv.schema";
import { buildAnalystSystemRules } from "./core-rules";
import { IndustryConfig, DOMAINS, type Domain } from "./industry-config";
import { detectDomain, getDomainLabel } from "./domain-detector";
import { normalizeText, buildLanguageInstruction } from "./text-utils";
import {
  computeSynonymScore,
  stemmedKeywordOverlap,
  findCertReason,
  findProjectReason,
  findTransferableSkills,
} from "./industry-matcher";
import { ensureKept, createTraceReport, logTraceReport, smartPrune } from "./data-integrity";
import type { Logger } from "../infrastructure/logging/logger";

/* ── ZOD SCHEMA ────────────────────────────────────────────────── */
const KeepExperienceSchema = z.object({ index: z.number(), role: z.string().catch(""), reason: z.string().catch(""), highlight: z.array(z.string()).catch([]) });
const KeepEducationSchema = z.object({ index: z.number(), degree: z.string().catch(""), field: z.string().catch(""), grade: z.string().catch(""), reason: z.string().catch("") });
const KeepCertSchema = z.object({ index: z.number(), name: z.string().catch(""), description: z.string().catch(""), reason: z.string().catch("") });
const KeepNamedSchema = z.object({ index: z.number(), name: z.string().catch(""), reason: z.string().catch("") });
const KeepLinkSchema = z.object({ index: z.number(), label: z.string().catch(""), url: z.string().catch(""), reason: z.string().catch("") });

/** Valid section keys for structural validation */
export const VALID_SECTION_KEYS = [
  "summary", "experience", "education", "skills", "certifications",
  "projects", "awards", "publications", "volunteer", "interests", "languages",
] as const;

/** Schema Firewall: layoutDirectives with structural validation */
const LayoutDirectivesSchema = z.object({
  sectionOrder: z.array(z.string())
    .refine(
      (order) => order.every((k) => VALID_SECTION_KEYS.includes(k as typeof VALID_SECTION_KEYS[number])),
      { message: "layoutDirectives.sectionOrder contains invalid section keys" }
    )
    .catch(["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"]),
  topSkills: z.array(z.string()).catch([]),
  emphasisColor: z.string().catch("#3182ce"),
}).catch({
  sectionOrder: ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"],
  topSkills: [],
  emphasisColor: "#3182ce",
});

export const AnalystStrategySchema = z.object({
  keep: z.object({ experience: z.array(KeepExperienceSchema).catch([]), education: z.array(KeepEducationSchema).catch([]), skills: z.array(z.string()).catch([]), certifications: z.array(KeepCertSchema).catch([]), projects: z.array(KeepNamedSchema).catch([]), awards: z.array(KeepNamedSchema).catch([]), publications: z.array(KeepNamedSchema).catch([]), volunteer: z.array(KeepNamedSchema).catch([]), interests: z.array(KeepNamedSchema).catch([]), additionalLinks: z.array(KeepLinkSchema).catch([]) }).catch({ experience: [], education: [], skills: [], certifications: [], projects: [], awards: [], publications: [], volunteer: [], interests: [], additionalLinks: [] }),
  remove: z.object({ experience: z.array(z.number()).catch([]), education: z.array(z.number()).catch([]), skills: z.array(z.string()).catch([]), certifications: z.array(z.number()).catch([]), projects: z.array(z.number()).catch([]), awards: z.array(z.number()).catch([]), publications: z.array(z.number()).catch([]), volunteer: z.array(z.number()).catch([]), interests: z.array(z.number()).catch([]), additionalLinks: z.array(z.number()).catch([]) }).catch({ experience: [], education: [], skills: [], certifications: [], projects: [], awards: [], publications: [], volunteer: [], interests: [], additionalLinks: [] }),
  strategy: z.object({ emphasis: z.array(z.string()).catch([]), tone: z.string().catch("professional"), order: z.array(z.string()).catch(["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"]), customRules: z.array(z.string()).catch([]) }).catch({ emphasis: [], tone: "professional", order: ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"], customRules: [] }),
  inferredStrengths: z.array(z.object({ skill: z.string().catch(""), evidence: z.array(z.string()).catch([]) })).catch([]),
  layoutDirectives: LayoutDirectivesSchema,
  // Insights for the "Pro & Contro" panel in the frontend
  shortcomings: z.array(z.string()).catch([]),
  strengths: z.array(z.string()).catch([]),
  interviewTips: z.array(z.string()).catch([]),
});

export type JsonStrategy = z.infer<typeof AnalystStrategySchema>;
export interface AnalystResult { jsonStrategy: JsonStrategy; summary: string; }

/* ── PUBLIC API ────────────────────────────────────────────────── */
export async function runAnalyst(
  jobAdvert: string, jsonProfile: JsonProfile, domainHint: string | undefined, parentLog: Logger,
  onTokens?: TokenReporter
): Promise<AnalystResult> {
  const log = parentLog.child({ agent: "ANALYST" });
  log.info("ANALYST", "Analyzing profile against job requirements");

  // Detect or use provided domain
  const domain: Domain = (domainHint as Domain) || detectDomain(jobAdvert);
  log.info("ANALYST", `Active domain: ${domain} (${getDomainLabel(domain)})`);

  const profileValidation = JsonProfileSchema.safeParse(jsonProfile);
  if (!profileValidation.success) {
    log.warn("ANALYST", "Invalid JsonProfile input: " + JSON.stringify(profileValidation.error.format(), null, 2));
  }

  const ollamaUp = await isOllamaAvailable();
  if (!ollamaUp) return runRuleBasedAnalysis(jobAdvert, jsonProfile, domain, log);
  return runAIAnalysis(jobAdvert, jsonProfile, domain, log, onTokens);
}

/* ── RULE-BASED FALLBACK (domain-aware) ────────────────────────── */
export function runRuleBasedAnalysis(jobAdvert: string, profile: JsonProfile, domain: Domain, log: Logger): AnalystResult {
  log.info("ANALYST", "Running rule-based analysis fallback");
  const jobNorm = normalizeText(jobAdvert);
  const safeArr = <T>(arr: T[] | undefined): T[] => arr ?? [];

  // Load domain config for section-specific scoring
  const domainCfg = domain !== "unknown" ? IndustryConfig[domain] : null;

  // Experience — stemmed synonym + keyword + IndustryMatcher
  const experience = safeArr(profile.experience).map((exp, idx) => {
    const profileText = normalizeText((exp.role ?? "") + " " + (exp.description ?? "") + " " + safeArr(exp.achievements).join(" "));
    const keywordMatches = stemmedKeywordOverlap(profileText, jobNorm);
    const synonymScore = computeSynonymScore(profileText, jobNorm);

    if (keywordMatches > 0 || synonymScore > 0) {
      return { index: idx, role: exp.role, reason: `Relevant: ${keywordMatches} keyword + ${synonymScore} synonym matches`, highlight: safeArr(exp.achievements).slice(0, 3) };
    }
    const transferable = findTransferableSkills(profileText);
    if (transferable.length === 0) transferable.push("Demonstrates professional maturity and work ethic");
    return { index: idx, role: exp.role, reason: `Transferable: ${transferable.join("; ")}`, highlight: safeArr(exp.achievements).slice(0, 2) };
  });

  // Certifications — external IndustryMatcher config + description relevance
  const certifications = safeArr(profile.certifications).map((cert, idx) => {
    const certText = (cert?.name ?? "") + " " + (cert?.issuer ?? "") + " " + (cert?.description ?? "");
    const reason = findCertReason(certText) ?? `${domainCfg?.competencyLabel ?? "Professional"} qualification (always shown)`;
    return { index: idx, name: cert?.name ?? "", description: cert?.description ?? "", reason };
  });

  // Projects — external IndustryMatcher config
  const projects = safeArr(profile.projects).map((proj, idx) => {
    const projText = (proj?.name ?? "") + " " + (proj?.description ?? "") + " " + safeArr(proj?.technologies).join(" ");
    let reason = findProjectReason(projText) ?? "Practical project demonstrating applied skills";
    const techMatches = safeArr(proj?.technologies).filter((t) => jobNorm.includes(t.toLowerCase()));
    if (techMatches.length > 0 && !reason.includes("directly relevant")) reason = `Uses job-relevant tech: ${techMatches.join(", ")}`;
    return { index: idx, name: proj?.name ?? "", reason };
  });

  // Always-kept sections
  const mkKeep = (arr: Array<{ degree?: string } | string>, reason: string) =>
    safeArr(arr as Array<unknown>).map((item, idx) => ({ index: idx, name: typeof item === "string" ? item : (item as { degree?: string }).degree ?? "", reason }));

  const education = safeArr(profile.education).map((edu, idx) => {
    const reasonParts = ["Academic qualification"];
    if (edu?.field) reasonParts.push(`Field: ${edu.field}`);
    if (edu?.grade) reasonParts.push(`Grade: ${edu.grade}`);
    return { index: idx, degree: edu?.degree ?? "", field: edu?.field ?? "", grade: edu?.grade ?? "", reason: reasonParts.join(" — ") };
  });
  const awards = mkKeep(profile.awards, "Professional recognition (always shown)");
  const publications = mkKeep(profile.publications, "Thought leadership (always shown)");
  const volunteer = mkKeep(profile.volunteer, "Community engagement (always shown)");
  const interests = mkKeep(profile.interests, "Cultural insight (always shown)");

  // Professional links — always kept, prioritized by relevance
  const additionalLinks = safeArr(profile.contact?.additionalLinks).map((link, idx) => {
    const linkText = `${link.label ?? ""} ${link.url ?? ""}`.toLowerCase();
    const isRelevant = domainCfg ? stemmedKeywordOverlap(linkText, jobNorm) > 0 : true;
    return {
      index: idx,
      label: link.label ?? "",
      url: link.url ?? "",
      reason: isRelevant ? `Relevant platform: ${link.label} matches job domain` : `Professional platform: ${link.label}`,
    };
  });

  const allSkills = [...safeArr(profile.skills?.technical), ...safeArr(profile.skills?.soft), ...safeArr(profile.skills?.tools), ...safeArr(profile.skills?.languages)];

  // ── Emphasis Techniques (Rule-Based) ──
  // Hierarchy Shifting: reorder sections based on domain priority + job relevance
  const sectionOrder = domainCfg?.sectionPriority ?? ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"];

  // Semantic Highlighting: identify top skills based on keyword overlap
  const topSkills = allSkills
    .map((skill) => ({ skill, score: stemmedKeywordOverlap(skill.toLowerCase(), jobNorm) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => s.skill);

  // Emphasis color based on domain
  const emphasisColor = domain === "tech" ? "#00f2ff" : domain === "legal" ? "#c5a059" : domain === "creative" ? "#6c5ce7" : "#3182ce";

  const inferredStrengths: JsonStrategy["inferredStrengths"] = [];
  if (safeArr(profile.experience).length >= 3) inferredStrengths.push({ skill: "Proven Professional Track Record", evidence: [`${safeArr(profile.experience).length} professional roles`] });
  if (safeArr(profile.certifications).length > 0) inferredStrengths.push({ skill: "Continuous Learning", evidence: [`${safeArr(profile.certifications).length} certifications`] });
  if (safeArr(profile.projects).length > 0) inferredStrengths.push({ skill: "Practical Application", evidence: [`${safeArr(profile.projects).length} projects`] });
  if (safeArr(profile.awards).length > 0) inferredStrengths.push({ skill: "Recognized Excellence", evidence: [`${safeArr(profile.awards).length} awards`] });

  // Build insight arrays for the "Pro & Contro" panel
  const strengths: string[] = [];
  const shortcomings: string[] = [];
  const interviewTips: string[] = [];

  if (safeArr(profile.experience).length >= 3) {
    strengths.push(`Strong professional track record with ${safeArr(profile.experience).length} roles`);
  } else {
    shortcomings.push("Limited work experience — consider highlighting projects and certifications more prominently");
  }
  if (safeArr(profile.certifications).length > 0) {
    strengths.push(`${safeArr(profile.certifications).length} professional certifications demonstrate commitment to learning`);
  }
  if (safeArr(profile.projects).length > 0) {
    strengths.push(`${safeArr(profile.projects).length} projects show practical, hands-on application of skills`);
    interviewTips.push("Prepare detailed walkthroughs of your projects — focus on challenges faced and how you solved them");
  }
  if (allSkills.length >= 8) {
    strengths.push(`Broad skill set with ${allSkills.length} identified competencies`);
  }
  if (shortcomings.length === 0) {
    interviewTips.push("Your profile aligns well with the role — focus on quantifying your achievements during the interview");
  } else {
    interviewTips.push("Address potential gaps proactively by emphasizing transferable skills and learning agility");
  }

  const strategy: JsonStrategy = {
    keep: { experience, education, skills: allSkills, certifications, projects, awards, publications, volunteer, interests, additionalLinks },
    remove: { experience: [], education: [], skills: [], certifications: [], projects: [], awards: [], publications: [], volunteer: [], interests: [], additionalLinks: [] },
    strategy: { emphasis: allSkills.slice(0, 5), tone: domainCfg?.tone ?? "professional and confident", order: sectionOrder, customRules: ["Keep ALL work experience — non-similar roles show transferable skills", "Keep ALL qualifications always visible", "Keep ALL cultural items (volunteer, interests) always visible", "Use action verbs; never invent metrics"] },
    inferredStrengths,
    layoutDirectives: { sectionOrder, topSkills, emphasisColor },
    shortcomings,
    strengths,
    interviewTips,
  };

  return { jsonStrategy: strategy, summary: `${getDomainLabel(domain)} analysis: ${safeArr(profile.experience).length} exp, ${safeArr(profile.certifications).length} certs, ${safeArr(profile.projects).length} projects — ALL kept.` };
}

/* ── AI-POWERED ANALYSIS (domain-aware) ────────────────────────── */
async function runAIAnalysis(
  jobAdvert: string, profile: JsonProfile, domain: Domain, log: Logger,
  onTokens?: TokenReporter
): Promise<AnalystResult> {
  const safeArr = <T>(arr: T[] | undefined): T[] => arr ?? [];

  // Defensive: malformed Fetcher output may pass an invalid profile
  if (!profile || typeof profile !== "object") {
    log.warn("ANALYST", "Invalid profile object received — switching to rule-based fallback");
    return runRuleBasedAnalysis(jobAdvert, profile, domain, log);
  }

  const langInstruction = buildLanguageInstruction(jobAdvert);
  const systemRules = buildAnalystSystemRules();
  const domainCfg = domain !== "unknown" ? IndustryConfig[domain] : null;

  const domainInstruction = domain !== "unknown" ? `
[DOMAIN: ${domainCfg?.label ?? domain}]
Analyze this profile through the lens of the ${domainCfg?.label ?? domain} industry.
- Use ${domainCfg?.label ?? domain}-specific terminology and strategic value propositions.
- Map certifications using ${domainCfg?.label ?? domain} credential standards.
- Tone: ${domainCfg?.tone ?? "professional"}.` : "";

  const systemPrompt = `You are a Data Curator — not an optimizer. Your mission is to identify the most relevant "truth-atoms" in the candidate's CV and decide their hierarchy for presentation.

${systemRules}

EMPHASIS TECHNIQUES (The Only Allowed Tools):
1. HIERARCHY SHIFTING: Determine the optimal order of sections. If Projects match the Job Ad better than Education, move Projects higher. If Certifications are highly relevant, place them immediately after Experience.
2. LINK HIERARCHY SHIFTING: If the candidate has professional platform links (GitHub, Kaggle, Portfolio, etc.), prioritize those most relevant to the job domain. Tech roles should highlight GitHub/Kaggle; Creative roles should highlight Portfolio/Behance.
3. SEMANTIC HIGHLIGHTING: Identify which bullet points within each experience entry must be prioritized (listed first) based on their relevance to the job requirements.
4. QUALITATIVE DETAILING: Suggest rephrasing tasks using industry jargon (jargon-matching) WITHOUT adding new facts or numbers. Example: "wrote code" → "implemented backend logic" only if the original role justifies it.

DATA FIDELITY — Preserve ALL expanded fields:
- Education: preserve field (faculty/area of study), startDate, and grade/GPA in every entry.
- Certifications: preserve description (what the certification validates).
- Contact: preserve all additionalLinks (GitHub, Kaggle, Portfolio, etc.).

PROHIBITION (FATAL ERROR if violated):
- ANY suggestion containing invented percentages, numbers, monetary values, or KPIs is a fatal error.
- Do NOT invent metrics: "increased X by 25%", "managed $2M budget", "led team of 12" — UNLESS these numbers exist verbatim in the source profile.

CRITICAL STRATEGY RULES:
1. KEEP ALL work experience entries — identify TRANSFERABLE skills for non-similar roles.
2. KEEP ALL qualifications ALWAYS: education, certifications, awards, publications.
3. KEEP ALL cultural items ALWAYS: volunteer work and personal interests.
4. KEEP ALL professional links ALWAYS: additionalLinks (GitHub, Kaggle, Portfolio, etc.).
5. Map certifications to job requirements via underlying skills and industry credential standards.
6. Map project technologies / methodologies to job requirements.
7. For "remove.skills": ONLY include skills with ZERO relevance.
8. Output valid JSON only.${domainInstruction}${langInstruction}`;

  const userPrompt = `## JOB ADVERTISEMENT
${jobAdvert}

## CANDIDATE PROFILE (JSON) — THIS IS THE ONLY SOURCE OF TRUTH
${JSON.stringify(smartPrune(profile, domain), null, 2)}

## INSTRUCTIONS

Analyse this profile against the job advert and output a JSON strategy.

You are a DATA CURATOR. Your job is to RE-ORGANIZE existing evidence, NOT to add new data.

EMPHASIS TECHNIQUES you must apply:
- HIERARCHY SHIFTING: Reorder sections so the MOST RELEVANT evidence appears first.
- SEMANTIC HIGHLIGHTING: Within each experience entry, list the most job-relevant bullets FIRST.
- QUALITATIVE DETAILING: Suggest jargon-matched rephrasings for the Writer (no new facts).

ZERO FABRICATION RULES (MANDATORY):
- Do NOT invent facts, numbers, dates, percentages, or specific results.
- Use ONLY data that appears in the candidate profile JSON above.
- highlight arrays must contain ONLY actual profile data — never invented achievements.
- Write ALL "reason" fields in the SAME language as the job advert.
- Any metric invention is a FATAL ERROR.

{
  "keep": {
    "experience": [{ "index": 0, "role": "exact title", "reason": "...", "highlight": ["achievement from profile"] }],
    "education": [{ "index": 0, "degree": "exact degree", "field": "exact field of study", "grade": "exact grade/GPA", "reason": "Always shown — Field: X, Grade: Y" }],
    "skills": ["skill names from profile"],
    "certifications": [{ "index": 0, "name": "exact cert name", "description": "exact cert description", "reason": "cross-domain relevance" }],
    "projects": [{ "index": 0, "name": "exact project name", "reason": "..." }],
    "awards": [{ "index": 0, "name": "exact award", "reason": "Always shown" }],
    "publications": [{ "index": 0, "name": "exact publication", "reason": "Always shown" }],
    "volunteer": [{ "index": 0, "name": "exact volunteer entry", "reason": "Always shown" }],
    "interests": [{ "index": 0, "name": "exact interest", "reason": "Always shown" }],
    "additionalLinks": [{ "index": 0, "label": "GitHub", "url": "https://github.com/...", "reason": "Relevant platform" }]
  },
  "remove": { "experience": [], "education": [], "skills": ["only-truly-irrelevant"], "certifications": [], "projects": [], "awards": [], "publications": [], "volunteer": [], "interests": [], "additionalLinks": [] },
  "strategy": { "emphasis": ["..."], "tone": "professional", "order": ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"], "customRules": ["..."] },
  "inferredStrengths": [{ "skill": "...", "evidence": ["must reference actual profile data"] }],
  "layoutDirectives": {
    "sectionOrder": ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"],
    "topSkills": ["most relevant skill 1", "most relevant skill 2", "..."],
    "emphasisColor": "#3182ce"
  },
  "shortcomings": ["specific gap between profile and job requirements — e.g., missing cloud certification for DevOps role"],
  "strengths": ["specific strength that aligns well — e.g., 5 years of Kubernetes experience matches job requirement"],
  "interviewTips": ["actionable tip for interview prep based on the gap analysis — e.g., prepare examples of scaling microservices"]
}

Return ONLY valid JSON. Use EXACT names from the profile — never invent.`;

  const report = createTraceReport("AI");

  try {
    const rawResponse = await chatWithOllamaJSON<unknown>(systemPrompt, userPrompt, { keepAlive: 0, log, onTokens });
    report.rawResponse = rawResponse;

    const parsed = AnalystStrategySchema.safeParse(rawResponse);
    if (!parsed.success) {
      report.validationPassed = false;
      report.validationErrors = JSON.stringify(parsed.error.format(), null, 2);
      logTraceReport(report, log);
      log.warn("ANALYST", "Zod validation failed — falling back to rule-based analysis");
      return runRuleBasedAnalysis(jobAdvert, profile, domain, log);
    }

    const result = parsed.data;

    // Post-processing — recover dropped items with expanded field preservation
    ensureKept(safeArr(profile.experience), result.keep.experience, (idx) => ({ index: idx, role: safeArr(profile.experience)[idx]?.role ?? "", reason: "Included — demonstrates professional experience", highlight: [] }), "experience", report.recovered);
    ensureKept(safeArr(profile.education), result.keep.education, (idx) => ({ index: idx, degree: safeArr(profile.education)[idx]?.degree ?? "", field: safeArr(profile.education)[idx]?.field ?? "", grade: safeArr(profile.education)[idx]?.grade ?? "", reason: "Academic qualification (always shown)" }), "education", report.recovered);
    ensureKept(safeArr(profile.certifications), result.keep.certifications, (idx) => ({ index: idx, name: safeArr(profile.certifications)[idx]?.name ?? "", description: safeArr(profile.certifications)[idx]?.description ?? "", reason: "Professional qualification (always shown)" }), "certifications", report.recovered);
    ensureKept(safeArr(profile.projects), result.keep.projects, (idx) => ({ index: idx, name: safeArr(profile.projects)[idx]?.name ?? "", reason: "Practical project (always shown)" }), "projects", report.recovered);
    ensureKept(safeArr(profile.awards), result.keep.awards, (idx) => ({ index: idx, name: safeArr(profile.awards)[idx] ?? "", reason: "Professional recognition (always shown)" }), "awards", report.recovered);
    ensureKept(safeArr(profile.publications), result.keep.publications, (idx) => ({ index: idx, name: safeArr(profile.publications)[idx] ?? "", reason: "Thought leadership (always shown)" }), "publications", report.recovered);
    ensureKept(safeArr(profile.volunteer), result.keep.volunteer, (idx) => ({ index: idx, name: safeArr(profile.volunteer)[idx] ?? "", reason: "Community engagement (always shown)" }), "volunteer", report.recovered);
    ensureKept(safeArr(profile.interests), result.keep.interests, (idx) => ({ index: idx, name: safeArr(profile.interests)[idx] ?? "", reason: "Cultural insight (always shown)" }), "interests", report.recovered);
    ensureKept(safeArr(profile.contact?.additionalLinks), result.keep.additionalLinks, (idx) => {
      const links = safeArr(profile.contact?.additionalLinks);
      const link = links[idx];
      return { index: idx, label: link?.label ?? "", url: link?.url ?? "", reason: "Professional platform (always shown)" };
    }, "additionalLinks", report.recovered);

    // Coverage stats — safeArr guards against undefined arrays from Fetcher
    report.coverage = {
      experience: { profile: safeArr(profile.experience).length, kept: safeArr(result.keep.experience).length },
      education: { profile: safeArr(profile.education).length, kept: safeArr(result.keep.education).length },
      certifications: { profile: safeArr(profile.certifications).length, kept: safeArr(result.keep.certifications).length },
      projects: { profile: safeArr(profile.projects).length, kept: safeArr(result.keep.projects).length },
    };

    logTraceReport(report, log);
    log.info("ANALYST", `AI analysis complete | Kept: ${safeArr(result.keep.experience).length} exp, ${safeArr(result.keep.certifications).length} certs — ALL preserved.`);
    return { jsonStrategy: result, summary: `${getDomainLabel(domain)} AI analysis: ${safeArr(result.keep.experience).length} exp, ${safeArr(result.keep.certifications).length} certs — ALL kept.` };
  } catch (err) {
    log.error("ANALYST", "AI analysis failed: " + (err instanceof Error ? err.message : String(err)));
    return runRuleBasedAnalysis(jobAdvert, profile, domain, log);
  }
}
