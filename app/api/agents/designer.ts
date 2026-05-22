/**
 * Designer Agent — Thin Orchestration Layer
 *
 * Responsibilities:
 *   1. Sanitize/normalize JsonCv
 *   2. Infer or receive DesignComposition
 *   3. Parse semantic actions from user instructions (rule-based + LLM fallback)
 *   4. Apply actions to DesignComposition (refine only)
 *   5. Resolve DesignState from DesignComposition
 *   6. Render semantic HTML
 *   7. Sanitize HTML
 *   8. Generate PDF
 *
 * The Designer does NOT:
 *   - generate CSS
 *   - contain template logic
 *   - hardcode renderer choices
 *   - mutate styles directly
 *   - produce HTML fragments
 *   - import from templates/
 *
 * All design-system imports are direct — no barrel files.
 */

import path from "path";
import { type JsonCv } from "./writer";
import { type Logger } from "../infrastructure/logging/logger";
import fs from "fs";
import { sanitizeCvHtml } from "../infrastructure/security";
import { convertHtmlToPdf } from "../infrastructure/pdf";
import type { TokenReporter } from "../infrastructure/ai/ollama";

// ── Design System: direct imports (no barrels) ──
import {
  type DesignComposition,
  inferInitialComposition,
} from "../design-system/composition";
import {
  applySemanticActionsToComposition,
} from "../design-system/semantic/actions";
import {
  resolveDesignState,
} from "../design-system/semantic/resolution";
import {
  parseSemanticActionsWithFallback,
} from "../design-system/semantic/parser";
import { renderSemanticHtml } from "../design-system/renderer";
import { designStateToCssVariables } from "../design-system/rendering/css-vars";
import { getBaseStyles } from "../design-system/rendering/base-styles";

// ── Types ──

export interface DesignerMainInput {
  jsonCv: JsonCv;
  jobTitle: string;
  domain: string;
}

export interface DesignerRefineInput {
  jsonCv: JsonCv;
  jobTitle: string;
  domain: string;
  currentDesignComposition: DesignComposition;
  instruction: string;
}

export interface DesignerResult {
  html: string;
  pdfPath: string;
  markdown: string;
  designComposition: DesignComposition;
}

// ── Public API ────────────────────────────────────────────────────────────

export async function runDesignerMain(
  input: DesignerMainInput,
  log: Logger,
  onTokens?: TokenReporter
): Promise<DesignerResult> {
  const timer = startTimer();
  const { jsonCv, domain } = input;

  // 1. Sanitize
  const cv = sanitizeJsonCv(jsonCv);

  // 2. Infer initial composition from CV content + domain
  const designComposition = inferInitialComposition(cv, domain, log);
  log.info("DESIGNER_MAIN", `Composition: layout="${designComposition.layoutId}" theme="${designComposition.themeId}" domain="${domain}"`);

  // 3. Resolve → Render → PDF
  const result = await renderPipeline(cv, input.jobTitle, designComposition, log);

  log.info("DESIGNER_MAIN", `Complete in ${timer()}ms: ${result.pdfPath}`);
  return result;
}

export async function runDesignerRefine(
  input: DesignerRefineInput,
  log: Logger,
  onTokens?: TokenReporter
): Promise<DesignerResult> {
  const timer = startTimer();
  const { jsonCv, instruction, currentDesignComposition } = input;

  // 1. Sanitize
  const cv = sanitizeJsonCv(jsonCv);

  // 2. Deep-clone current composition — NEVER mutate input
  let designComposition: DesignComposition = deepCloneComposition(currentDesignComposition);

  const beforeLayout = designComposition.layoutId;
  const beforeTheme = designComposition.themeId;
  const beforeMain = [...designComposition.sectionLayout.main];
  const beforeSidebar = designComposition.sectionLayout.sidebar ? [...designComposition.sectionLayout.sidebar] : [];
  const beforeVariants = { ...designComposition.sectionVariants };
  const beforeOverrides = deepCloneSectionDataOverrides(designComposition.sectionDataOverrides);

  log.info("DESIGNER_REFINE", `Before — layout=${beforeLayout} theme=${beforeTheme}`);
  log.info("DESIGNER_REFINE", `Before — sectionLayout.main=[${beforeMain.join(", ")}] sidebar=[${beforeSidebar.join(", ")}]`);
  log.info("DESIGNER_REFINE", `Before — sectionVariants=${JSON.stringify(beforeVariants)}`);
  log.info("DESIGNER_REFINE", `Before — sectionDataOverrides=${JSON.stringify(beforeOverrides)}`);

  // 3. Parse and apply semantic actions from instruction
  if (instruction?.trim()) {
    log.info("DESIGNER_REFINE", `Parsing: "${instruction}"`);

    // Rule-based first, LLM fallback only when no rules match
    const actions = await parseSemanticActionsWithFallback(instruction, log, onTokens);

    if (actions.length > 0) {
      log.info("DESIGNER_REFINE", `Actions: ${actions.map((a) => a.type).join(", ")}`);
      designComposition = applySemanticActionsToComposition(designComposition, actions, log);

      const afterLayout = designComposition.layoutId;
      const afterTheme = designComposition.themeId;
      const afterMain = [...designComposition.sectionLayout.main];
      const afterSidebar = designComposition.sectionLayout.sidebar ? [...designComposition.sectionLayout.sidebar] : [];
      const afterVariants = { ...designComposition.sectionVariants };
      const afterOverrides = deepCloneSectionDataOverrides(designComposition.sectionDataOverrides);

      // ACCEPTANCE: log before/after composition state
      log.info("DESIGNER_REFINE", `After — layout=${afterLayout} theme=${afterTheme}`);
      log.info("DESIGNER_REFINE", `After — sectionLayout.main=[${afterMain.join(", ")}] sidebar=[${afterSidebar.join(", ")}]`);
      log.info("DESIGNER_REFINE", `After — sectionVariants=${JSON.stringify(afterVariants)}`);
      log.info("DESIGNER_REFINE", `After — sectionDataOverrides=${JSON.stringify(afterOverrides)}`);

      // ACCEPTANCE: log before/after composition layout
      if (beforeLayout !== afterLayout) {
        log.info("DESIGNER_REFINE", `Layout changed: "${beforeLayout}" → "${afterLayout}"`);
      }
      if (beforeTheme !== afterTheme) {
        log.info("DESIGNER_REFINE", `Theme changed: "${beforeTheme}" → "${afterTheme}"`);
      }
      // Check if section variants changed
      const variantKeys = new Set([...Object.keys(beforeVariants), ...Object.keys(afterVariants)]);
      for (const key of variantKeys) {
        if (beforeVariants[key] !== afterVariants[key]) {
          log.info("DESIGNER_REFINE", `Variant changed: ${key}="${beforeVariants[key] || "(none)"}" → "${afterVariants[key] || "(none)"}"`);
        }
      }
      // Check if section layout changed
      const mainChanged = beforeMain.join(",") !== afterMain.join(",");
      const sidebarChanged = beforeSidebar.join(",") !== afterSidebar.join(",");
      if (mainChanged || sidebarChanged) {
        log.info("DESIGNER_REFINE", `Section layout changed: main=${mainChanged} sidebar=${sidebarChanged}`);
      }
      // Check if sectionDataOverrides changed
      const overridesChanged = JSON.stringify(beforeOverrides) !== JSON.stringify(afterOverrides);
      if (overridesChanged) {
        log.info("DESIGNER_REFINE", `SectionDataOverrides changed`);
      }

      log.info("DESIGNER_REFINE", `Rendering: layout="${afterLayout}" theme="${afterTheme}"`);
    } else {
      log.info("DESIGNER_REFINE", "No actions matched — re-rendering with current composition");
    }
  } else {
    log.info("DESIGNER_REFINE", "Empty instruction — re-rendering with current composition");
  }

  // 4. Resolve → Render → PDF
  const result = await renderPipeline(cv, input.jobTitle, designComposition, log);

  log.info("DESIGNER_REFINE", `Complete in ${timer()}ms: ${result.pdfPath}`);
  return result;
}

// ── Render Pipeline (shared between main + refine) ────────────────────────

async function renderPipeline(
  cv: JsonCv,
  jobTitle: string,
  designComposition: DesignComposition,
  log: Logger
): Promise<DesignerResult> {
  // Resolve DesignState from composition
  const designState = resolveDesignState(designComposition, log);

  // Render semantic HTML — renderer receives BOTH composition and designState
  log.info("DESIGNER", `Rendering: layout=${designState.layoutId} theme=${designState.themeId}`);
  let html = renderSemanticHtml(cv, designComposition, designState);

  // Inject CSS variables + base styles in a SINGLE style block
  const cssVars = designStateToCssVariables(designState);
  const styleBlock = `<style>\n${cssVars}\n${getBaseStyles()}\n</style>`;
  html = html.replace("<head>", `<head>\n${styleBlock}`);

  // Sanitize
  html = sanitizeCvHtml(html);

  // Write HTML + generate PDF
  const safeTitle = jobTitle.replace(/\W+/g, "_") || "cv";
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const layoutId = designComposition.layoutId;
  const htmlPath = path.join(outputDir, `${safeTitle}_${layoutId}.html`);
  const pdfPath = path.join(outputDir, `${safeTitle}_${layoutId}.pdf`);

  fs.writeFileSync(htmlPath, html);
  await convertHtmlToPdf(html, pdfPath, layoutId);

  const htmlBase64 = Buffer.from(html).toString("base64");

  return {
    html: htmlBase64,
    pdfPath,
    markdown: cv.markdown || "",
    designComposition,
  };
}

// ── Sanitization ───────────────────────────────────────────────────────────

function sanitizeJsonCv(cv: JsonCv): JsonCv {
  const clone = JSON.parse(JSON.stringify(cv)) as JsonCv;
  if (!clone.sections) clone.sections = [];
  if (!clone.skills) clone.skills = { categories: [] };
  if (!clone.contact) clone.contact = {};
  return clone;
}

// ── Composition cloning ────────────────────────────────────────────────────

function deepCloneComposition(c: DesignComposition): DesignComposition {
  return {
    layoutId: c.layoutId,
    themeId: c.themeId,
    semanticState: {
      ...c.semanticState,
      hierarchy: { ...c.semanticState.hierarchy },
      layoutPreference: { ...c.semanticState.layoutPreference },
    },
    sectionLayout: {
      main: [...c.sectionLayout.main],
      sidebar: c.sectionLayout.sidebar ? [...c.sectionLayout.sidebar] : undefined,
    },
    sectionVariants: { ...c.sectionVariants },
    sectionDataOverrides: deepCloneSectionDataOverrides(c.sectionDataOverrides),
    renderingOverrides: [...c.renderingOverrides],
  };
}

function deepCloneSectionDataOverrides(o: DesignComposition["sectionDataOverrides"]): DesignComposition["sectionDataOverrides"] {
  if (!o || Object.keys(o).length === 0) return {};
  const clone: DesignComposition["sectionDataOverrides"] = {};
  if (o.skills) clone.skills = { levels: o.skills.levels ? { ...o.skills.levels } : {} };
  if (o.languages) clone.languages = {
    levels: o.languages.levels ? { ...o.languages.levels } : {},
    proficiencies: o.languages.proficiencies ? { ...o.languages.proficiencies } : {},
  };
  return clone;
}

// ── Timer ──────────────────────────────────────────────────────────────────

function startTimer() {
  const t0 = Date.now();
  return () => Date.now() - t0;
}
