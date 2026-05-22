/**
 * Design System — Base Styles
 *
 * CSS reset + base styling + variant styles for semantic HTML output.
 * All visual customization comes from theme CSS variables.
 * This is the ONLY place CSS generation logic lives.
 */

export function getBaseStyles(): string {
  return `
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--cv-font,sans-serif);font-size:var(--cv-fs-base,10pt);color:var(--cv-text,#1f2937);background:var(--cv-bg,#fff);line-height:1.5}

/* ── Page ── */
.cv-page{max-width:210mm;margin:0 auto;padding:var(--cv-page-margin,15mm)}

/* ── Layout: Multi-column ── */
.cv-layout--sidebar-left .cv-body,
.cv-layout--sidebar-right .cv-body {
  display: flex;
  gap: 0;
  align-items: flex-start;
}

.cv-layout--sidebar-left .cv-sidebar,
.cv-layout--sidebar-right .cv-sidebar,
.cv-layout--sidebar-left .cv-main,
.cv-layout--sidebar-right .cv-main {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.cv-layout--sidebar-left .cv-sidebar {
  width: 35%;
  order: 0;
  padding-right: 16px;
  flex-shrink: 0;
}

.cv-layout--sidebar-left .cv-main {
  width: 65%;
  order: 1;
  padding-left: 16px;
  flex-shrink: 0;
}

.cv-layout--sidebar-right .cv-sidebar {
  width: 35%;
  order: 1;
  padding-left: 16px;
  flex-shrink: 0;
}

.cv-layout--sidebar-right .cv-main {
  width: 65%;
  order: 0;
  padding-right: 16px;
  flex-shrink: 0;
}
.cv-title{color:var(--cv-muted,#9ca3af);font-size:1.1em}

/* ── Sections ── */
.cv-section{margin-bottom:var(--cv-space-section,12px)}
.cv-section-title{
  font-size:var(--cv-fs-heading,12pt);
  font-weight:700;
  color:var(--cv-primary,#111827);
  margin-bottom:var(--cv-space-sm,6px);
  text-transform:uppercase;
  letter-spacing:0.5px
}

/* ── Entries ── */
.cv-entry{margin-bottom:var(--cv-space-md,8px)}
.cv-entry-header{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.cv-entry-title{font-weight:600;color:var(--cv-text,#1f2937)}
.cv-entry-dates{color:var(--cv-muted,#9ca3af);font-size:0.9em;white-space:nowrap}
.cv-entry-subtitle{color:var(--cv-muted,#9ca3af);font-size:0.95em}
.cv-entry-description{margin-top:2px}
.cv-entry-bullets{list-style:disc;padding-left:18px;margin-top:4px}
.cv-entry-bullets li{margin-bottom:2px}

/* ── Compact entries ── */
.cv-entry--compact{margin-bottom:4px}
.cv-entry--compact .cv-entry-subtitle{font-size:0.9em}

/* ── Card entries ── */
.cv-entry--card{
  padding:8px 12px;
  border:1px solid var(--cv-border,#e5e7eb);
  border-radius:6px;
  margin-bottom:8px;
  background:var(--cv-surface,#f9fafb)
}
.cv-entry-grid{display:flex;flex-direction:column;gap:8px}

/* ── Editorial entries ── */
.cv-entry--editorial{
  display:flex;
  gap:12px;
  margin-bottom:12px
}
.cv-entry-accent-bar{
  width:4px;
  background:var(--cv-accent,#3b82f6);
  border-radius:2px;
  flex-shrink:0
}
.cv-entry-content{flex:1}

/* ── Timeline ── */
.cv-timeline{
  position:relative;
  padding-left:20px
}
.cv-timeline::before{
  content:"";
  position:absolute;
  left:6px;
  top:4px;
  bottom:4px;
  width:2px;
  background:var(--cv-border,#e5e7eb)
}
.cv-timeline-entry{
  position:relative;
  margin-bottom:12px;
  padding-left:16px
}
.cv-timeline-marker{
  position:absolute;
  left:-20px;
  top:6px;
  width:10px;
  height:10px;
  border-radius:50%;
  background:var(--cv-accent,#3b82f6);
  border:2px solid var(--cv-bg,#fff)
}
.cv-timeline-content{
  background:var(--cv-surface,#f9fafb);
  padding:8px 12px;
  border-radius:4px
}

/* ── Skills ── */
.cv-skills{display:flex;flex-wrap:wrap;gap:var(--cv-space-md,8px)}
.cv-skill-group{display:flex;flex-direction:column;gap:4px}
.cv-skill-group-title{font-weight:600;font-size:0.9em;color:var(--cv-primary,#111827)}
.cv-skill-items{display:flex;flex-wrap:wrap;gap:4px}
.cv-skill-item{padding:2px 8px;border-radius:12px;font-size:0.85em}

/* ── Skills: compact ── */
.cv-skill-item--compact{padding:1px 6px;font-size:0.8em}

/* ── Skills: terminal ── */
.cv-skills--terminal .cv-skill-group--terminal{
  font-family:var(--cv-font,monospace)
}
.cv-skill-item--terminal{
  background:none;
  padding:0 4px;
  font-family:var(--cv-font,monospace)
}

/* ── Skills: visual matrix ── */
.cv-skill-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(80px,1fr));
  gap:4px
}
.cv-skill-item--matrix{
  text-align:center;
  padding:4px;
  border:1px solid var(--cv-border,#e5e7eb);
  border-radius:4px;
  font-size:0.8em
}

/* ── Skills: expertise bars ── */
.cv-expertise-bar{
  display:flex;
  align-items:center;
  gap:8px;
  margin-bottom:4px
}
.cv-expertise-label{
  font-size:0.85em;
  min-width:80px;
  flex-shrink:0
}
.cv-expertise-track{
  flex:1;
  height:6px;
  background:var(--cv-surface,#f0f0f0);
  border-radius:3px;
  overflow:hidden
}
.cv-expertise-fill{
  height:100%;
  background:var(--cv-accent,#3b82f6);
  border-radius:3px
}

/* ── Skills: accent pills ── */
.cv-skills--accent-pills{
  display:flex;
  flex-direction:column;
  gap:8px
}
.cv-skills--accent-pills .cv-skill-items{
  display:flex;
  flex-wrap:wrap;
  gap:6px
}
.cv-skills--accent-pills.cv-skills--flat{
  flex-direction:row;
  flex-wrap:wrap
}
.cv-skill-pill--accent{
  display:inline-flex;
  align-items:center;
  padding:4px 12px;
  border-radius:999px;
  background:var(--cv-accent,#3b82f6);
  color:var(--cv-bg,#fff);
  font-size:0.85em;
  line-height:1.2;
  white-space:nowrap
}

/* ── Skills: floating cards ── */
.cv-skill-card{
  padding:10px;
  border:1px solid var(--cv-border,#e5e7eb);
  border-radius:8px;
  margin-bottom:8px
}
.cv-skill-card-title{
  font-size:0.9em;
  font-weight:600;
  margin-bottom:6px;
  color:var(--cv-primary,#111827)
}
.cv-skill-card-items{display:flex;flex-wrap:wrap;gap:4px}

/* ── Interests ── */
.cv-interests{display:flex;flex-wrap:wrap;gap:6px}
.cv-interest-item{padding:2px 10px;border-radius:12px;font-size:0.85em}

/* ── Contacts ── */
.cv-contacts{display:flex;flex-direction:column;gap:4px}
.cv-contact{display:flex;align-items:center;gap:6px;font-size:0.9em}

/* ── Contacts: inline ── */
.cv-contacts--inline{
  flex-direction:row;
  flex-wrap:wrap;
  gap:4px;
  font-size:0.85em
}

/* ── Contacts: grid ── */
.cv-contacts--grid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:8px
}
.cv-contact--grid{
  flex-direction:column;
  align-items:flex-start;
  gap:2px
}
.cv-contact--grid .cv-contact-label{
  font-size:0.75em;
  text-transform:uppercase;
  color:var(--cv-muted,#9ca3af)
}

/* ── Contacts: ribbon ── */
.cv-contacts--ribbon{
  flex-direction:row;
  flex-wrap:wrap;
  gap:0;
  justify-content:center;
  font-size:0.85em;
  padding:4px 0
}
.cv-contact--ribbon .cv-contact-icon{margin-right:2px}
.cv-contact-sep{color:var(--cv-muted,#9ca3af);margin:0 8px}

/* ── Languages ── */
.cv-languages{display:flex;flex-direction:column;gap:2px}
.cv-language{font-size:0.9em}
.cv-language-proficiency{color:var(--cv-muted,#9ca3af)}

/* ═══ Bar Layouts: Sidebar (vertical list) vs Single-Column (2-col grid) ═══ */
.cv-sidebar .cv-skills--bars,
.cv-sidebar .cv-languages--bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cv-layout--single-column .cv-skills--bars,
.cv-layout--single-column .cv-languages--bars {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
  max-width: 100%;
}

.cv-expertise-bar,
.cv-language-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cv-expertise-label {
  font-size: calc(var(--cv-fs) * 0.92);
  color: var(--cv-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.cv-expertise-track {
  flex: 1;
  min-width: 60px;
  height: 5px;
  background: var(--cv-border);
  border-radius: 3px;
  overflow: hidden;
}

.cv-expertise-fill {
  height: 100%;
  background: var(--cv-accent);
  border-radius: 3px;
}

/* ── Print ── */
@media print{
  body{background:#fff}
  .cv-page{padding:0;max-width:none}
}
@page{size:A4;margin:10mm}
`;
}
