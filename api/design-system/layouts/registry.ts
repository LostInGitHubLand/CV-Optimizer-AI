/**
 * Design System — Layout Registry
 *
 * Layouts define ONLY document structure:
 *   - zones and regions
 *   - section flow
 *   - structural positioning
 *   - column behavior
 *
 * Layouts DO NOT define:
 *   - colors
 *   - fonts
 *   - visual identity
 *   - aesthetic tone
 *
 * Canonical layout IDs are semantic structural names.
 * Each layout has a template directory for the HTML Mustache template,
 * but the template contains ONLY structural HTML — all visual styling
 * comes from theme CSS variables.
 */

export type LayoutId =
  | "single-column"
  | "sidebar-left"
  | "sidebar-right"
  ;

export interface Layout {
  id: LayoutId;
  name: string;
  description: string;
  /** Directory containing the Mustache template.html */
  templateDir: string;
  /** Which sections go in the sidebar (if any) */
  sidebarSections: string[];
  /** Which sections go in the main area */
  mainSections: string[];
  /** Default section order */
  defaultSectionOrder: string[];
  /** Maximum columns supported */
  maxColumns: number;
  /** Sidebar position */
  sidebarPosition: "left" | "right" | "none";
  /** Sidebar width as percentage */
  sidebarWidth: number;
}

export const LAYOUTS: Record<LayoutId, Layout> = {
  "single-column": {
    id: "single-column",
    name: "Single Column",
    description: "Clean top-to-bottom vertical flow. No sidebar. All sections stack sequentially. Safest fallback.",
    templateDir: "classic-single-column",
    sidebarSections: [],
    mainSections: ["summary", "experience", "education", "skills", "certifications", "projects", "awards", "publications", "volunteer", "interests", "languages"],
    defaultSectionOrder: ["summary", "experience", "skills", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"],
    maxColumns: 3,
    sidebarPosition: "none",
    sidebarWidth: 0,
  },
  "sidebar-left": {
    id: "sidebar-left",
    name: "Sidebar Left",
    description: "Two-column: sidebar (35%) on the LEFT holds contacts, skills, languages, interests. Main area on the right for experience, education, certifications.",
    templateDir: "sidebar-split-technical",
    sidebarSections: ["contacts", "skills", "languages", "interests"],
    mainSections: ["summary", "experience", "education", "certifications", "projects", "awards", "publications", "volunteer"],
    defaultSectionOrder: ["experience", "education", "certifications", "projects", "awards", "publications", "volunteer"],
    maxColumns: 2,
    sidebarPosition: "left",
    sidebarWidth: 35,
  },
  "sidebar-right": {
    id: "sidebar-right",
    name: "Sidebar Right",
    description: "Two-column: main content on the LEFT, sidebar (35%) on the RIGHT holds skills, certifications, languages. Centered header across both regions.",
    templateDir: "centered-formal-stack",
    sidebarSections: ["skills", "certifications", "languages"],
    mainSections: ["summary", "experience", "education", "projects", "awards", "publications", "volunteer"],
    defaultSectionOrder: ["summary", "experience", "education", "certifications", "projects", "awards", "publications", "volunteer", "interests"],
    maxColumns: 2,
    sidebarPosition: "right",
    sidebarWidth: 35,
  },
};

export function getLayout(id: LayoutId): Layout {
  const layout = LAYOUTS[id];
  if (!layout) {
    // AC14: Fail loudly during development, graceful fallback in production
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[getLayout] Unknown layout ID: "${id}". Valid: ${Object.keys(LAYOUTS).join(", ")}`);
    }
    console.warn(`[getLayout] Unknown layout ID: "${id}" — falling back to single-column`);
    return LAYOUTS["single-column"];
  }
  return layout;
}

/** Check if a layout supports a given number of columns */
export function layoutSupportsColumns(layoutId: LayoutId, cols: number): boolean {
  return cols <= (LAYOUTS[layoutId]?.maxColumns ?? 1);
}

/** Domain → default layout inference */
export function inferLayoutFromDomain(domain: string): LayoutId {
  const d = domain.toLowerCase().trim();
  if (d.startsWith("tech") || d.includes("software") || d.includes("devops") || d.includes("cyber") || d.includes("data") || d === "it" || d.includes("engineer")) return "sidebar-left";
  if (d.includes("legal") || d.includes("law") || d.includes("attorney") || d.includes("compliance") || d.includes("medical") || d.includes("healthcare")) return "sidebar-right";
  if (d.includes("creative") || d.includes("design") || d.includes("marketing") || d.includes("media") || d.includes("content")) return "sidebar-left";
  return "single-column";
}
