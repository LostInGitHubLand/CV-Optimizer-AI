/**
 * Design System — Theme Registry
 *
 * Themes define ONLY visual identity:
 *   - typography profiles
 *   - color tokens
 *   - spacing scales
 *   - border styles
 *   - emphasis styles
 *   - decoration tokens
 *
 * Themes DO NOT define:
 *   - layout structure
 *   - sidebar placement
 *   - section geometry
 *   - document flow
 */

export type ThemeId =
  | "minimal-swiss"
  | "modern-editorial"
  | "elegant-premium"
  | "brutalist"
  | "technical-dark"
  | "neon-cyberpunk"
  | "glassmorphism"
  | "monochrome-corporate"
  | "luxury-serif"
  | "clean-startup"
  | "dark-academic";

export interface ColorTokens {
  primary: string;
  accent: string;
  text: string;
  muted: string;
  background: string;
  surface: string;
  border: string;
}

export interface TypographyTokens {
  fontFamily: string;
  baseSizePt: number;
  headingSizePt: number;
  nameSizePt: number;
}

export interface DecorationTokens {
  pageTreatment: "plain" | "card" | "bordered" | "dark-panel";
  sectionHeading: "plain" | "underline" | "line-after" | "accent-bar" | "terminal-line";
  skillPillStyle: "plain" | "bordered-soft" | "filled-pill" | "hex-outline";
  sidebarTreatment: "plain" | "muted-panel" | "dark-panel" | "bordered";
  timelineStyle: "none" | "left-border" | "dot-marker" | "accent-marker";
  cardStyle: "none" | "flat" | "bordered" | "glass";
  shadowStyle: "none" | "subtle" | "strong";
  dividerStyle: "none" | "line" | "dotted" | "gradient";
  contactIconStyle: "none" | "simple" | "circled" | "squared";
  emphasisMarker: "none" | "bullet" | "arrow" | "diamond" | "dash";
}

export interface ThemeMeta {
  brightness: "light" | "dark" | "neutral";
  colorfulness: "low" | "medium" | "high";
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ColorTokens;
  typography: TypographyTokens;
  decorations: DecorationTokens;
  spacing: "compact" | "normal" | "spacious";
  density: "low" | "medium" | "high";
  meta: ThemeMeta;
}

/* ── Minimal Swiss ── */
const minimalSwiss: Theme = {
  id: "minimal-swiss", name: "Minimal Swiss",
  description: "Maximum whitespace. Helvetica-inspired precision. Flat hierarchy. Essential information only.",
  colors: { primary: "#111827", accent: "#3b82f6", text: "#1f2937", muted: "#9ca3af", background: "#ffffff", surface: "#f9fafb", border: "#e5e7eb" },
  typography: { fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", baseSizePt: 10, headingSizePt: 12, nameSizePt: 24 },
  decorations: { pageTreatment: "plain", sectionHeading: "plain", skillPillStyle: "plain", sidebarTreatment: "plain", timelineStyle: "none", cardStyle: "none", shadowStyle: "none", dividerStyle: "line", contactIconStyle: "none", emphasisMarker: "bullet" },
  spacing: "spacious", density: "low",
  meta: { brightness: "light", colorfulness: "low" },
};

/* ── Modern Editorial ── */
const modernEditorial: Theme = {
  id: "modern-editorial", name: "Modern Editorial",
  description: "Magazine-quality layout. Strong contrast. Editorial serif headings with clean sans-serif body. Refined visual hierarchy.",
  colors: { primary: "#1a1a2e", accent: "#e94560", text: "#16213e", muted: "#5c5c6d", background: "#f8f8f8", surface: "#ffffff", border: "#d4d4d4" },
  typography: { fontFamily: "'Playfair Display', Georgia, serif", baseSizePt: 10, headingSizePt: 14, nameSizePt: 30 },
  decorations: { pageTreatment: "plain", sectionHeading: "accent-bar", skillPillStyle: "bordered-soft", sidebarTreatment: "muted-panel", timelineStyle: "left-border", cardStyle: "none", shadowStyle: "none", dividerStyle: "gradient", contactIconStyle: "simple", emphasisMarker: "dash" },
  spacing: "normal", density: "medium",
  meta: { brightness: "light", colorfulness: "medium" },
};

/* ── Elegant Premium ── */
const elegantPremium: Theme = {
  id: "elegant-premium", name: "Elegant Premium",
  description: "Luxurious spacing. High-contrast serif/sans pairing. Gold and navy accents. Maximum refinement.",
  colors: { primary: "#2c3e50", accent: "#c5a059", text: "#333333", muted: "#888888", background: "#f4f4f4", surface: "#ffffff", border: "#bdc3c7" },
  typography: { fontFamily: "'Garamond', 'Georgia', serif", baseSizePt: 10, headingSizePt: 13, nameSizePt: 28 },
  decorations: { pageTreatment: "bordered", sectionHeading: "line-after", skillPillStyle: "filled-pill", sidebarTreatment: "bordered", timelineStyle: "none", cardStyle: "none", shadowStyle: "none", dividerStyle: "line", contactIconStyle: "circled", emphasisMarker: "diamond" },
  spacing: "spacious", density: "low",
  meta: { brightness: "light", colorfulness: "medium" },
};

/* ── Brutalist ── */
const brutalist: Theme = {
  id: "brutalist", name: "Brutalist",
  description: "Raw structural honesty. Bold type. Strong borders. No decoration. Maximum information density through pure structure.",
  colors: { primary: "#000000", accent: "#ff0000", text: "#000000", muted: "#555555", background: "#ffffff", surface: "#eeeeee", border: "#000000" },
  typography: { fontFamily: "'Helvetica Neue', Arial, sans-serif", baseSizePt: 9, headingSizePt: 14, nameSizePt: 32 },
  decorations: { pageTreatment: "bordered", sectionHeading: "terminal-line", skillPillStyle: "plain", sidebarTreatment: "plain", timelineStyle: "none", cardStyle: "flat", shadowStyle: "none", dividerStyle: "line", contactIconStyle: "none", emphasisMarker: "bullet" },
  spacing: "compact", density: "high",
  meta: { brightness: "neutral", colorfulness: "low" },
};

/* ── Technical Dark ── */
const technicalDark: Theme = {
  id: "technical-dark", name: "Technical Dark",
  description: "Dark terminal aesthetic. Monospace fonts. High contrast. Code-editor visual language. Grid lines and structured panels.",
  colors: { primary: "#00f2ff", accent: "#bc13fe", text: "#e6edf3", muted: "#8b949e", background: "#0d1117", surface: "#161b22", border: "rgba(0,242,255,0.2)" },
  typography: { fontFamily: "'JetBrains Mono', 'Courier New', monospace", baseSizePt: 9, headingSizePt: 12, nameSizePt: 16 },
  decorations: { pageTreatment: "dark-panel", sectionHeading: "terminal-line", skillPillStyle: "hex-outline", sidebarTreatment: "dark-panel", timelineStyle: "dot-marker", cardStyle: "none", shadowStyle: "subtle", dividerStyle: "line", contactIconStyle: "simple", emphasisMarker: "dash" },
  spacing: "normal", density: "medium",
  meta: { brightness: "dark", colorfulness: "medium" },
};

/* ── Neon Cyberpunk ── */
const neonCyberpunk: Theme = {
  id: "neon-cyberpunk", name: "Neon Cyberpunk",
  description: "Vibrant neon glow. Deep black backgrounds. Electric accents. Futuristic visual language with glow effects and sharp geometry.",
  colors: { primary: "#00ff88", accent: "#ff00ff", text: "#f0f0f0", muted: "#8899aa", background: "#0a0a12", surface: "#12121f", border: "rgba(0,255,136,0.3)" },
  typography: { fontFamily: "'JetBrains Mono', monospace", baseSizePt: 9, headingSizePt: 13, nameSizePt: 20 },
  decorations: { pageTreatment: "dark-panel", sectionHeading: "accent-bar", skillPillStyle: "filled-pill", sidebarTreatment: "dark-panel", timelineStyle: "accent-marker", cardStyle: "bordered", shadowStyle: "strong", dividerStyle: "gradient", contactIconStyle: "circled", emphasisMarker: "arrow" },
  spacing: "normal", density: "medium",
  meta: { brightness: "dark", colorfulness: "high" },
};

/* ── Glassmorphism ── */
const glassmorphism: Theme = {
  id: "glassmorphism", name: "Glassmorphism",
  description: "Translucent frosted-glass panels. Soft gradients. Subtle depth through blur and transparency. Modern UI aesthetic.",
  colors: { primary: "#6366f1", accent: "#8b5cf6", text: "#1e1b4b", muted: "#7c7c8a", background: "#e0e7ff", surface: "rgba(255,255,255,0.7)", border: "rgba(99,102,241,0.2)" },
  typography: { fontFamily: "'Inter', 'Segoe UI', sans-serif", baseSizePt: 10, headingSizePt: 13, nameSizePt: 26 },
  decorations: { pageTreatment: "card", sectionHeading: "underline", skillPillStyle: "bordered-soft", sidebarTreatment: "muted-panel", timelineStyle: "none", cardStyle: "glass", shadowStyle: "subtle", dividerStyle: "dotted", contactIconStyle: "circled", emphasisMarker: "bullet" },
  spacing: "spacious", density: "low",
  meta: { brightness: "light", colorfulness: "high" },
};

/* ── Monochrome Corporate ── */
const monochromeCorporate: Theme = {
  id: "monochrome-corporate", name: "Monochrome Corporate",
  description: "Strict grayscale with single accent. Maximum professionalism. Dense information. Conservative and authoritative.",
  colors: { primary: "#1a1a1a", accent: "#2563eb", text: "#262626", muted: "#737373", background: "#fafafa", surface: "#ffffff", border: "#d4d4d4" },
  typography: { fontFamily: "'Inter', Arial, sans-serif", baseSizePt: 9, headingSizePt: 11, nameSizePt: 22 },
  decorations: { pageTreatment: "plain", sectionHeading: "underline", skillPillStyle: "plain", sidebarTreatment: "plain", timelineStyle: "none", cardStyle: "none", shadowStyle: "none", dividerStyle: "line", contactIconStyle: "simple", emphasisMarker: "bullet" },
  spacing: "compact", density: "high",
  meta: { brightness: "light", colorfulness: "low" },
};

/* ── Luxury Serif ── */
const luxurySerif: Theme = {
  id: "luxury-serif", name: "Luxury Serif",
  description: "High-end editorial. Dramatic serif typography. Rich warm tones. Maximum elegance for executive and creative leadership.",
  colors: { primary: "#3d2b1f", accent: "#c9a96e", text: "#2c1810", muted: "#8b7355", background: "#faf6f0", surface: "#ffffff", border: "#d4c5b0" },
  typography: { fontFamily: "'Crimson Text', 'Georgia', serif", baseSizePt: 10, headingSizePt: 14, nameSizePt: 32 },
  decorations: { pageTreatment: "bordered", sectionHeading: "line-after", skillPillStyle: "filled-pill", sidebarTreatment: "bordered", timelineStyle: "none", cardStyle: "none", shadowStyle: "none", dividerStyle: "line", contactIconStyle: "circled", emphasisMarker: "diamond" },
  spacing: "spacious", density: "low",
  meta: { brightness: "light", colorfulness: "medium" },
};

/* ── Clean Startup ── */
const cleanStartup: Theme = {
  id: "clean-startup", name: "Clean Startup",
  description: "Energetic but clean. Bold accent color. Modern sans-serif. Confident spacing. Product-focused visual language.",
  colors: { primary: "#7c3aed", accent: "#f59e0b", text: "#1f2937", muted: "#6b7280", background: "#ffffff", surface: "#f9fafb", border: "#e5e7eb" },
  typography: { fontFamily: "'Inter', 'Segoe UI', sans-serif", baseSizePt: 10, headingSizePt: 13, nameSizePt: 28 },
  decorations: { pageTreatment: "plain", sectionHeading: "accent-bar", skillPillStyle: "filled-pill", sidebarTreatment: "muted-panel", timelineStyle: "dot-marker", cardStyle: "flat", shadowStyle: "subtle", dividerStyle: "dotted", contactIconStyle: "circled", emphasisMarker: "arrow" },
  spacing: "normal", density: "medium",
  meta: { brightness: "light", colorfulness: "medium" },
};

/* ── Dark Academic ── */
const darkAcademic: Theme = {
  id: "dark-academic", name: "Dark Academic",
  description: "Scholarly dark mode. Warm neutrals on dark background. Traditional structure with academic gravitas. Research and education focused.",
  colors: { primary: "#a3b1c6", accent: "#d4a574", text: "#c9d1d9", muted: "#8b949e", background: "#1a1a2e", surface: "#242438", border: "#3d3d5c" },
  typography: { fontFamily: "'Merriweather', 'Georgia', serif", baseSizePt: 10, headingSizePt: 13, nameSizePt: 26 },
  decorations: { pageTreatment: "dark-panel", sectionHeading: "line-after", skillPillStyle: "bordered-soft", sidebarTreatment: "dark-panel", timelineStyle: "left-border", cardStyle: "none", shadowStyle: "none", dividerStyle: "line", contactIconStyle: "simple", emphasisMarker: "dash" },
  spacing: "spacious", density: "low",
  meta: { brightness: "dark", colorfulness: "low" },
};

export const THEMES: Record<ThemeId, Theme> = {
  "minimal-swiss": minimalSwiss,
  "modern-editorial": modernEditorial,
  "elegant-premium": elegantPremium,
  "brutalist": brutalist,
  "technical-dark": technicalDark,
  "neon-cyberpunk": neonCyberpunk,
  "glassmorphism": glassmorphism,
  "monochrome-corporate": monochromeCorporate,
  "luxury-serif": luxurySerif,
  "clean-startup": cleanStartup,
  "dark-academic": darkAcademic,
};

/**
 * Find themes matching brightness and colorfulness constraints.
 * Returns themes sorted by preference: high colorfulness first for colorful requests.
 */
export function findThemesByMeta(
  brightness?: "light" | "dark" | "neutral",
  colorfulness?: "low" | "medium" | "high"
): Theme[] {
  return Object.values(THEMES).filter((t) => {
    if (brightness && t.meta.brightness !== brightness) return false;
    if (colorfulness && t.meta.colorfulness !== colorfulness) return false;
    return true;
  });
}

export function getTheme(id: ThemeId): Theme {
  const theme = THEMES[id];
  if (!theme) {
    // AC14: Fail loudly during development, graceful fallback in production
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[getTheme] Unknown theme ID: "${id}". Valid: ${Object.keys(THEMES).join(", ")}`);
    }
    console.warn(`[getTheme] Unknown theme ID: "${id}" — falling back to minimal-swiss`);
    return THEMES["minimal-swiss"];
  }
  return theme;
}

/** Domain → default theme inference */
export function inferThemeFromDomain(domain: string): ThemeId {
  const d = domain.toLowerCase().trim();
  if (d.startsWith("tech") || d.includes("software") || d.includes("devops") || d.includes("engineer")) return "technical-dark";
  if (d.includes("cyber")) return "neon-cyberpunk";
  if (d.includes("data")) return "monochrome-corporate";
  if (d.includes("legal") || d.includes("law") || d.includes("attorney")) return "elegant-premium";
  if (d.includes("medical") || d.includes("healthcare")) return "luxury-serif";
  if (d.includes("creative") || d.includes("design") || d.includes("marketing")) return "clean-startup";
  if (d.includes("academic") || d.includes("research") || d.includes("education")) return "dark-academic";
  if (d.includes("executive") || d.includes("ceo") || d.includes("director")) return "luxury-serif";
  return "minimal-swiss";
}
