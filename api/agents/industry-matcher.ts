import config from "./industry-config.json";
import { normalizeText, stemWord, tokenizeAndStem } from "./text-utils";

/** Load-time parsed regexes from the external JSON config. */
const certificationPatterns = config.certificationMappings.map((m) => ({
  regex: new RegExp(m.pattern, "i"),
  reason: m.reason,
}));

const projectPatterns = config.projectMappings.map((m) => ({
  regex: new RegExp(m.pattern, "i"),
  reason: m.reason,
}));

/**
 * Compute a weighted synonym score between two text blocks.
 * Uses stemmed tokens from the external SKILL_SYNONYMS config so
 * morphological variants ("managed" / "managing" / "manager") match
 * the same root automatically.
 */
export function computeSynonymScore(profileText: string, jobText: string): number {
  const profileTokens = new Set(tokenizeAndStem(profileText));
  const jobTokens = new Set(tokenizeAndStem(jobText));
  let score = 0;

  for (const [category, roots] of Object.entries(config.skillSynonyms)) {
    const categoryRoots = tokenizeAndStem(category + " " + roots.join(" "));
    const profileMatch = categoryRoots.some((r) => profileTokens.has(r));
    const jobMatch = categoryRoots.some((r) => jobTokens.has(r));
    if (profileMatch && jobMatch) score += 3;
    else if (profileMatch) score += 1;
  }
  return score;
}

/**
 * Direct keyword overlap using stemmed tokens.
 */
export function stemmedKeywordOverlap(profileText: string, jobText: string): number {
  const profileTokens = new Set(tokenizeAndStem(profileText));
  const jobTokens = tokenizeAndStem(jobText);
  return jobTokens.filter((t) => profileTokens.has(t)).length;
}

/**
 * Find the first matching strategic reason for a certification name.
 */
export function findCertReason(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const m of certificationPatterns) {
    if (m.regex.test(lower)) return m.reason;
  }
  return undefined;
}

/**
 * Find the first matching strategic reason for a project description.
 */
export function findProjectReason(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const m of projectPatterns) {
    if (m.regex.test(lower)) return m.reason;
  }
  return undefined;
}

/**
 * Build transferable-skills array from a profile text block.
 * Returns the categories (from config) that match.
 */
export function findTransferableSkills(text: string): string[] {
  const matched: string[] = [];
  const descStemmed = new Set(tokenizeAndStem(text));
  for (const [category, roots] of Object.entries(config.skillSynonyms)) {
    if (roots.some((r) => descStemmed.has(r))) matched.push(category);
  }
  return matched;
}
