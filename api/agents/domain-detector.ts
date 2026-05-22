import { IndustryConfig, DOMAINS, type Domain } from "./industry-config";
import { tokenizeAndStem } from "./text-utils";

/**
 * DomainDetector — pre-flight domain classification
 *
 * Scans arbitrary text (job advert, CV content, etc.) and returns the
 * best-matching professional domain.  Uses stemmed keyword overlap
 * against each domain's detectionKeywords from IndustryConfig.
 *
 * The Fetcher performs the FIRST detection (on the combined CV text)
 * and passes the result downstream so the entire pipeline stays
 * synchronised.
 */

interface DomainScore {
  domain: Domain;
  score: number;
  matched: string[];
}

/**
 * Scan text and score all four domains.
 * Returns scores sorted highest-first for debugging.
 */
export function scoreDomains(text: string): DomainScore[] {
  const tokens = new Set(tokenizeAndStem(text));
  const scores: DomainScore[] = [];

  for (const domain of DOMAINS) {
    const cfg = IndustryConfig[domain];
    const matched: string[] = [];
    let score = 0;

    for (const kw of cfg.detectionKeywords) {
      const stemmedKw = tokenizeAndStem(kw);
      const hasMatch = stemmedKw.some((t) => tokens.has(t));
      if (hasMatch) {
        score++;
        matched.push(kw);
      }
    }

    scores.push({ domain, score, matched });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Pick the single best domain.  Requires a minimum threshold of 2
 * keyword matches to avoid noise on very short / ambiguous inputs.
 * Falls back to "unknown".
 */
export function detectDomain(text: string): Domain {
  const scores = scoreDomains(text);
  if (scores.length === 0) return "unknown";

  const best = scores[0];
  if (best.score >= 2) return best.domain;

  // If top two are tied and both below threshold, stay unknown
  if (scores.length > 1 && scores[1].score === best.score) return "unknown";

  return "unknown";
}

/**
 * Get the human-readable label for a domain.
 */
export function getDomainLabel(domain: Domain): string {
  if (domain === "unknown") return "General / Cross-Domain";
  return IndustryConfig[domain].label;
}
