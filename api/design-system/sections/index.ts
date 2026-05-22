/**
 * Design System — Section Renderers
 *
 * Pure semantic section rendering with variant support.
 * Import from here for all section rendering needs.
 */

export { renderSection, renderSummarySection, renderInterestsSection } from "./section";
export type { SectionRenderContext } from "./section";

export { renderExperienceSection } from "./experience";
export type { ExperienceVariant } from "./experience";

export { renderEducationSection } from "./education";
export type { EducationVariant } from "./education";

export { renderSkillsSection, renderSkillsFlat } from "./skills";
export type { SkillsVariant } from "./skills";

export { renderContacts, extractContacts } from "./contacts";
export type { ContactsVariant, ContactItem } from "./contacts";

export { renderEntry, renderCertEntry, renderAwardEntry } from "./entry";
export type { EntryData } from "./entry";

export { renderEntrySectionWithVariant } from "./generic-variant";
export type { GenericVariant } from "./generic-variant";

export { renderLanguages, extractLanguages } from "./languages";
