/**
 * Section Renderer — Languages
 *
 * Reads levels/proficiencies from sectionDataOverrides first,
 * then falls back to the language item's own level string.
 *
 * Rendering rules:
 *   - Default/list mode: "Language: Label" — never percentages
 *     If no level exists, renders only the language name
 *   - Proficiency-bars mode: bar with numeric width — never percentage text
 *     Missing levels render as low-opacity bars (no label fallback)
 *   - Source labels pass through unchanged ("Professional" stays "Professional")
 */

import type { Logger } from "../../infrastructure/logging/logger";
import type { JsonCv } from "../../agents/writer";
import { escapeHtml } from "../shared/utils";

export interface LanguageInfo {
  language: string;
  level?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXT → NUMERIC MAPPING (for bar width calculation only)
// ═══════════════════════════════════════════════════════════════════════════

const TEXT_TO_NUMERIC: Record<string, number> = {
  // Common proficiency
  native: 100, "native speaker": 100, "mother tongue": 100, bilingual: 100,
  "full professional": 90, c2: 95,
  fluent: 90, c1: 90, proficient: 80, professional: 80, "working professional": 80,
  advanced: 80, b2: 80,
  intermediate: 60, b1: 65,
  basic: 35, a2: 45, elementary: 35,
  a1: 30, beginner: 30,
};

function textToNumeric(text: string): number | null {
  const key = text.toLowerCase().trim();
  // Try exact match first
  if (TEXT_TO_NUMERIC[key] !== undefined) return TEXT_TO_NUMERIC[key];
  // Try single-word match
  return TEXT_TO_NUMERIC[key] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE NORMALIZATION
// Detect: "English (Professional)", "English: Professional", "English - Professional"
// ═══════════════════════════════════════════════════════════════════════════

function normalizeLanguageItem(raw: string): { language: string; level?: string } {
  const trimmed = raw.trim();

  // Pattern: "English (Professional)" or "English(Professional)"
  const parenMatch = trimmed.match(/^([^(]+)\(([^)]+)\)\s*$/);
  if (parenMatch) {
    return { language: parenMatch[1].trim(), level: parenMatch[2].trim() };
  }

  // Pattern: "English: Professional" or "English - Professional" or "English — Professional"
  const sepMatch = trimmed.match(/^([^:\-—]+)[:\-—]\s*(.+)$/);
  if (sepMatch) {
    return { language: sepMatch[1].trim(), level: sepMatch[2].trim() };
  }

  // Plain language name, no level
  return { language: trimmed };
}

// ═══════════════════════════════════════════════════════════════════════════
// LABEL RESOLUTION — pass-through, no fabrication
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve the display label for a language.
 * Priority:
 *   1. Explicit text proficiency override (proficiencies map)
 *   2. Existing textual level — pass through AS-IS ("Professional" → "Professional")
 *   3. Numeric override → convert to label
 *   4. Numeric level from item → convert to label
 *   5. No label (return "")
 */
function resolveLanguageLabel(
  language: string,
  levelStr: string | undefined,
  levels: Record<string, number> | undefined,
  proficiencies: Record<string, string> | undefined
): string {
  // 1. Explicit text proficiency override
  if (proficiencies) {
    const prof = proficiencies[language] || proficiencies[language.toLowerCase()];
    if (prof) return prof.charAt(0).toUpperCase() + prof.slice(1);
  }

  // 2. Existing textual level — pass through as-is
  if (levelStr) {
    const trimmed = levelStr.trim();
    // Only pass through if it looks like a text label
    if (!/^\d+$/.test(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }

  // 3 & 4. Numeric → convert to label
  const numeric = resolveNumericLevel(language, levelStr, levels);
  if (numeric !== null) return numericToLabel(numeric);

  // 5. No level — return empty (caller renders name only)
  return "";
}

/**
 * Resolve a language's numeric level (for bar width only).
 * Priority:
 *   1. Explicit numeric level override
 *   2. Explicit textual proficiency mapped to number
 *   3. Existing level string (numeric or text)
 *   4. null
 */
function resolveNumericLevel(
  language: string,
  levelStr: string | undefined,
  levels: Record<string, number> | undefined,
  proficiencies?: Record<string, string> | undefined
): number | null {
  // 1. Explicit numeric level override
  if (levels) {
    if (levels[language] !== undefined) return clampLevel(levels[language]);
    if (levels[language.toLowerCase()] !== undefined) return clampLevel(levels[language.toLowerCase()]);
  }

  // 2. Explicit textual proficiency mapped to number
  if (proficiencies) {
    const prof = proficiencies[language] || proficiencies[language.toLowerCase()];
    if (prof) {
      const asNum = parseInt(prof.trim(), 10);
      if (!Number.isNaN(asNum) && asNum > 0) return clampLevel(asNum);
      const asText = textToNumeric(prof.trim());
      if (asText !== null) return asText;
    }
  }

  // 3. Existing level string — numeric or text
  if (levelStr) {
    const trimmed = levelStr.trim();
    const asNum = parseInt(trimmed, 10);
    if (!Number.isNaN(asNum) && asNum > 0) return clampLevel(asNum);
    const asText = textToNumeric(trimmed);
    if (asText !== null) return asText;
  }

  return null;
}

function numericToLabel(level: number): string {
  if (level >= 95) return "Native";
  if (level >= 85) return "Fluent";
  if (level >= 70) return "Advanced";
  if (level >= 45) return "Intermediate";
  return "Basic";
}

function clampLevel(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACT
// ═══════════════════════════════════════════════════════════════════════════

export function extractLanguages(cv: JsonCv): LanguageInfo[] {
  const items: LanguageInfo[] = [];

  // 1. Try cv.languages (array of strings, from jsonCvGenerator)
  const rawLangs = (cv as Record<string, unknown>).languages;
  if (Array.isArray(rawLangs) && rawLangs.length > 0) {
    for (const lang of rawLangs) {
      if (typeof lang === "string") {
        items.push(normalizeLanguageItem(lang));
      } else {
        const obj = lang as Record<string, string>;
        items.push({
          language: obj.language || "",
          level: obj.level,
        });
      }
    }
    return items.filter((l) => l.language);
  }

  // 2. Try languages section in cv.sections
  const section = cv.sections?.find((s) => s.type === "languages");
  if (section?.entries?.length) {
    for (const e of section.entries) {
      const heading = e.heading || "";
      // Normalize heading in case it contains level info
      const normalized = normalizeLanguageItem(heading);
      // If heading had level info, use it; otherwise check subheading
      items.push({
        language: normalized.language,
        level: normalized.level || e.subheading || undefined,
      });
    }
  }
  return items.filter((l) => l.language);
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════════════════

export type LanguagesVariant = "default" | "proficiency-bars" | "proficiency-list";

export function renderLanguages(
  items: LanguageInfo[],
  variant: LanguagesVariant = "default",
  levels?: Record<string, number>,
  proficiencies?: Record<string, string>
): string {
  if (!items.length) return "";

  const effectiveVariant: LanguagesVariant =
    variant === "expertise-bars" ? "proficiency-bars" : variant;

  if (effectiveVariant === "proficiency-bars") {
    return renderProficiencyBars(items, levels, proficiencies);
  }

  // Default / proficiency-list: "Language: Label" — if no label, name only
  return `<div class="cv-languages">\n${items.map((l) => {
    const label = resolveLanguageLabel(l.language, l.level, levels, proficiencies);
    const labelHtml = label ? `<span class="cv-language-proficiency">: ${escapeHtml(label)}</span>` : "";
    return `<div class="cv-language">${escapeHtml(l.language)}${labelHtml}</div>`;
  }).join("\n")}\n</div>`;
}

function renderProficiencyBars(
  items: LanguageInfo[],
  levels?: Record<string, number>,
  proficiencies?: Record<string, string>
): string {
  const bars = items.map((l) => {
    const numeric = resolveNumericLevel(l.language, l.level, levels, proficiencies);
    // If no numeric level, render low-opacity bar (no label, no fallback)
    const level = numeric ?? 0;
    const opacity = numeric === null ? "0.25" : "1";
    return `<div class="cv-expertise-bar cv-language-bar" style="opacity:${opacity}">\n<span class="cv-expertise-label">${escapeHtml(l.language)}</span>\n<div class="cv-expertise-track">\n<div class="cv-expertise-fill" style="width:${level}%"></div>\n</div></div>`;
  }).join("\n");

  return `<div class="cv-languages cv-languages--bars">\n${bars}\n</div>`;
}
