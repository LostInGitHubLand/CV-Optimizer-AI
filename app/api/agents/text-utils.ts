/**
 * Text Normalisation Pipeline
 *
 * Shared across Analyst (rule-based matching) and any agent that needs
 * fuzzy text comparison.  Pure functions, zero external deps.
 */

/** Remove punctuation, lowercase, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Basic English stemmer — strips common suffixes so "managed/managing/manager"
 *  all reduce to the same root "manag".  Lightweight; avoids pulling in a
 *  full NLP library. */
export function stemWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length <= 3) return w;

  const suffixes = [
    { pat: /(ational|tional|ization|fulness|iveness|ivity|ment)$/, rep: "" },
    { pat: /(ance|ence|able|ible|ment|ness|tion|sion|less|ness|ing|ed|er|est|ism|ist|ize|ise|ify)$/, rep: "" },
    { pat: /(s|es)$/, rep: "" },
  ];

  for (const { pat, rep } of suffixes) {
    const stemmed = w.replace(pat, rep);
    if (stemmed !== w && stemmed.length >= 3) return stemmed;
  }
  return w;
}

/** Tokenise, normalise, and stem a block of text into an array of roots. */
export function tokenizeAndStem(text: string): string[] {
  const normalised = normalizeText(text);
  return normalised.split(/\s+/).map(stemWord).filter((t) => t.length > 2);
}

/** Detect non-English text by non-ASCII ratio heuristic. */
export function detectLanguageHint(text: string): "en" | "non-english" {
  if (!text) return "en";
  const nonAscii = (text.match(/[^\x00-\x7F]/g) || []).length;
  const ratio = nonAscii / text.length;
  return ratio > 0.15 ? "non-english" : "en";
}

/** Strip "undefined" placeholders from all string fields recursively. */
export function stripUndefined(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj === "undefined" || obj === "null" ? "" : obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined);
  }
  if (obj && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = stripUndefined(value);
    }
    return result;
  }
  return obj;
}
export function buildLanguageInstruction(jobAdvert: string): string {
  const lang = detectLanguageHint(jobAdvert);
  if (lang === "non-english") {
    return `
[LANGUAGE INSTRUCTION] The job advert appears to be non-English. Write ALL "reason" fields in the SAME language as the job advert. Do NOT translate candidate data — only the strategic reasons should match the job advert's language.`;
  }
  return "";
}
