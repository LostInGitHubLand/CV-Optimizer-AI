import { isOllamaAvailable, chatWithOllamaJSON } from "../infrastructure/ai/ollama";
import type { TokenReporter } from "../infrastructure/ai/ollama";
import { scrapeProfile } from "../infrastructure/scraping";
import { JsonProfileSchema, type JsonProfile, type FetcherResult } from "../../src/lib/validations/cv.schema";
import { detectDomain } from "./domain-detector";
import type { Logger } from "../infrastructure/logging/logger";
import { buildFetcherSystemRules } from "./core-rules";


/**
 * Fetcher: Extract structured JSON profile from a website URL.
 * 1. Scrape raw text from the website
 * 2. Combine with any user updates text
 * 3. Use AI (qwen3) to extract detailed, precise structured JSON
 */
export async function runFetcher(
  url: string, updates: string | undefined, parentLog: Logger,
  onTokens?: TokenReporter,
  domain?: string
): Promise<FetcherResult> {
  const log = parentLog.child({ agent: "FETCHER" });
  log.info("FETCHER", "Scraping profile from URL: " + url);
  const rawProfile = await scrapeProfile(url);
  const rawText = formatProfileText(rawProfile);
  const combinedText = buildCombinedText(rawText, updates);
  return extractJsonProfile(combinedText, rawProfile, log, onTokens, domain);
}

/**
 * Fetcher (PDF): Extract structured JSON profile from raw PDF text.
 * 1. The raw PDF text is already extracted by pdf-parse in cv-router.ts
 * 2. Combine with any user updates text
 * 3. Use AI (qwen3) to extract detailed, precise structured JSON
 */
export async function runFetcherOnPdf(
  pdfText: string, updates: string | undefined, parentLog: Logger,
  onTokens?: TokenReporter,
  domain?: string
): Promise<FetcherResult> {
  const log = parentLog.child({ agent: "FETCHER" });
  log.info("FETCHER", "Processing extracted PDF text (length: " + pdfText.length + ")");
  const combinedText = buildCombinedText(pdfText, updates);
  return extractJsonProfile(combinedText, null, log, onTokens, domain);
}

function buildCombinedText(sourceText: string, updates?: string): string {
  if (!updates || updates.trim().length === 0) {
    return sourceText;
  }
  return `=== SOURCE CV / PROFILE ===\n${sourceText}\n\n=== USER UPDATES (to be merged into profile) ===\n${updates}`;
}

/**
 * Extract structured JsonProfile using AI (qwen3) from the combined raw text.
 * The AI is instructed to read both the source CV text and user updates,
 * merge them intelligently, and output a rich, detailed JSON structure.
 */
async function extractJsonProfile(
  combinedText: string,
  rawProfile: Awaited<ReturnType<typeof scrapeProfile>> | null,
  log: Logger,
  onTokens?: TokenReporter,
  preDetectedDomain?: string
): Promise<FetcherResult> {
  // Use the pre-detected domain from the pipeline (single source of truth).
  // Fallback to local detection only if none was provided.
  const domain = preDetectedDomain || detectDomain(combinedText);
  log.info("FETCHER", `Using domain: ${domain}${preDetectedDomain ? " (from pipeline)" : " (local detection)"}`);

  const ollamaUp = await isOllamaAvailable();

  if (!ollamaUp) {
    log.warn("FETCHER", "Ollama offline, using rule-based extraction");
    return { ...fallbackExtraction(combinedText, rawProfile, log, domain), domain };
  }

  log.info("FETCHER", "Using qwen3 AI to extract detailed structured profile");

  const domainInstructions = domain !== "unknown"
    ? `\nDOMAIN-AWARE EXTRACTION: This profile appears to be in the ${domain} domain. Adapt your extraction accordingly:\n${getDomainExtractionHints(domain)}`
    : "";

  const systemPrompt = `You are an expert CV data extraction and structuring specialist. Your task is to read raw CV/profile text (combined with user updates) and extract every detail into a precise, structured JSON object.${buildFetcherSystemRules()}

EXTRACTION RULES:
1. Read BOTH the source CV text AND the user updates. Merge them intelligently.
2. Extract EVERY job with full detail: role title, company name, location, start/end dates, a rich description, and 3-5 specific achievements.
3. Extract ALL education entries with: degree, institution, field of study (faculty/area), start date, year (completion), grade/GPA, and any honors/details. SEPARATE "Degree" from "Field of Study" — they are distinct fields.
4. Extract ALL certifications with: name, issuer, year, AND a full description of what the certification covers or validates.
5. Extract ALL projects with descriptions and technologies used.
6. Categorize skills precisely: technical (domain-specific hard skills), soft (communication, leadership), languages (spoken/written), tools (software, instruments, equipment).
7. Extract contact info: email, phone, LinkedIn URL, location, personal website. ALSO extract any professional platform links (GitHub, Kaggle, Portfolio, Dribbble, Behance, etc.) into the additionalLinks array with label and URL.
8. Write a compelling 2-3 sentence professional summary based on the full profile.
9. NEVER invent information not present in the text. If a field is missing, use empty string "" or empty array []. CRITICAL: NEVER output the literal word "undefined", "null", "N/A", or "none" as a placeholder value. Omit the field entirely or use "" instead.
10. Extract ALL awards, publications, volunteer work, and personal/interests.
11. Map domain-specific roles to standard structure: medical "rotations" → experience entries, legal "cases" → projects, artistic "exhibitions" → projects/publications.
12. Output ONLY valid JSON — no markdown, no explanations.${domainInstructions}`;

  const userPrompt = `Extract the following combined CV text into structured JSON.

${combinedText.substring(0, 12000)}

Output ONLY this JSON structure (fill every field you can find):

{
  "name": "Full Name",
  "title": "Professional Title / Headline",
  "contact": {
    "email": "",
    "phone": "",
    "linkedin": "",
    "location": "",
    "website": "",
    "additionalLinks": [
      { "label": "GitHub", "url": "https://github.com/username" },
      { "label": "Portfolio", "url": "https://portfolio.example.com" }
    ]
  },
  "summary": "2-3 sentence professional summary",
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name",
      "location": "City, Country",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or Present",
      "description": "Rich paragraph describing responsibilities and scope",
      "achievements": ["Specific measurable achievement 1", "Specific achievement 2", "Specific achievement 3"]
    }
  ],
  "education": [
    {
      "degree": "Degree Name",
      "institution": "University/School Name",
      "field": "Field of Study / Faculty",
      "startDate": "YYYY",
      "year": "YYYY",
      "grade": "GPA or Final Grade",
      "details": "Honors, thesis topic, etc."
    }
  ],
  "skills": {
    "technical": ["JavaScript", "React", "AWS"],
    "soft": ["Leadership", "Communication"],
    "languages": ["English (Native)", "Spanish (Conversational)"],
    "tools": ["Git", "Docker", "Jira"]
  },
  "certifications": [
    { "name": "AWS Solutions Architect", "issuer": "Amazon Web Services", "year": "2023", "description": "Validates expertise in designing distributed systems on AWS" }
  ],
  "projects": [
    { "name": "E-commerce Platform", "description": "Built a scalable e-commerce platform handling 10K daily users", "technologies": ["Next.js", "PostgreSQL", "Stripe"] }
  ],
  "awards": ["Dean's List 2022", "Hackathon Winner"],
  "publications": ["Paper title if any"],
  "volunteer": ["Volunteer role if any"],
  "interests": ["Relevant professional interests"]
}`;

  try {
    // Phase 1: ask the AI for raw JSON (no type assertion — we validate ourselves)
    const rawResponse = await chatWithOllamaJSON<unknown>(systemPrompt, userPrompt, { keepAlive: 0, log, onTokens });

    // Phase 2: runtime validation with Zod
    const parsed = JsonProfileSchema.safeParse(rawResponse);

    if (!parsed.success) {
      log.warn("FETCHER", "Zod validation failed — AI returned malformed JsonProfile");
      log.warn("FETCHER", "Validation errors: " + JSON.stringify(parsed.error.format(), null, 2));
      log.warn("FETCHER", "Raw AI response keys: " + Object.keys(rawResponse as object).join(", "));
      return { ...fallbackExtraction(combinedText, rawProfile, log, domain), domain };
    }

    const jsonProfile = parsed.data;
    log.info("FETCHER", `AI extraction + Zod validation OK | Name: ${jsonProfile.name} | Exp: ${jsonProfile.experience.length} | Edu: ${jsonProfile.education.length} | Skills: ${jsonProfile.skills.technical.length}`);

    return {
      jsonProfile,
      rawText: combinedText.substring(0, 8000),
      domain,
    };
  } catch (err) {
    log.error("FETCHER", "AI extraction failed: " + (err instanceof Error ? err.message : String(err)));
    return { ...fallbackExtraction(combinedText, rawProfile, log, domain), domain };
  }
}

/* ── Fallback extraction when AI is offline ──────────────────────── */

/**
 * Schema-driven rule-based extraction.
 *
 * Strategy: build a partialData object containing ONLY what we find
 * in the raw text.  At the end, hand it to JsonProfileSchema.parse()
 * — Zod supplies every missing array/string default automatically.
 */
export function fallbackExtraction(
  combinedText: string,
  rawProfile: Awaited<ReturnType<typeof scrapeProfile>> | null,
  log: Logger,
  preDetectedDomain?: string
): FetcherResult {
  log.info("FETCHER", "Running rule-based fallback extraction");
  const lines = combinedText.split("\n").map((l) => l.trim()).filter(Boolean);
  const cleanLines = lines.filter((line) => !isPromptInjectionLine(line));

  // Partial object — only populated fields matter; Zod fills the rest.
  const partialData: Record<string, unknown> = {};

  // Contact regexes + professional platform links
  const emailMatch = combinedText.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = combinedText.match(/\+?[\d\s\-\(\)]{7,20}/);
  const linkedinMatch = combinedText.match(/linkedin\.com\/in\/[\w-]+/i);
  const websiteMatch = combinedText.match(/(?:https?:\/\/)?(?:www\.)?([\w-]+\.(?:com|io|dev|net|org|co))\/?/i);

  const additionalLinks: Array<{ label: string; url: string }> = [];
  const githubMatch = combinedText.match(/(?:github\.com\/|github:\s*)([\w-]+)/i);
  if (githubMatch) additionalLinks.push({ label: "GitHub", url: `https://github.com/${githubMatch[1]}` });
  const kaggleMatch = combinedText.match(/(?:kaggle\.com\/|kaggle:\s*)([\w-]+)/i);
  if (kaggleMatch) additionalLinks.push({ label: "Kaggle", url: `https://kaggle.com/${kaggleMatch[1]}` });
  const portfolioMatch = combinedText.match(/(?:portfolio|behance|dribbble|medium)[:\s]+(https?:\/\/[^\s]+)/i);
  if (portfolioMatch) additionalLinks.push({ label: "Portfolio", url: portfolioMatch[1] });

  if (emailMatch || phoneMatch || linkedinMatch || additionalLinks.length) {
    partialData.contact = {
      email: emailMatch?.[0] ?? "",
      phone: phoneMatch?.[0] ?? "",
      linkedin: linkedinMatch ? `https://${linkedinMatch[0]}` : "",
      website: websiteMatch?.[0] ?? "",
      additionalLinks,
    };
  }
  function isSectionHeader(line: string): boolean {
    return /^(skills?|technical skills|technologies|competencies|proficiency|experience|work experience|employment|career|education|academic|degree|university|college|projects?|portfolio|certifications?|certificates?|licenses?|accreditations?|diplomas?|summary|about|profile|objective|contact)$/i.test(
      line.trim());
    } 
  // Name — first plausible candidate in the first 5 lines
  for (const line of cleanLines.slice(0, 5)) {
    if (
      !isSectionHeader(line) &&
      line.length > 2 &&
      line.length < 50 &&
      /^[A-Z][a-zA-Z\s'-]+$/.test(line)
    ) {
      partialData.name = line;
      break;
    }
  }
  // Raw-profile enrichment (overrides only if we still have nothing)
  if (rawProfile) {
    if (!partialData.name && rawProfile.name) partialData.name = rawProfile.name;
    if (!partialData.title && rawProfile.title) partialData.title = rawProfile.title;
  }

  // Section-level extraction
  const experience: Array<Record<string, unknown>> = [];
  const education: Array<Record<string, unknown>> = [];
  const certifications: Array<Record<string, unknown>> = [];
  const projects: Array<Record<string, unknown>> = [];
  const technical: string[] = [];
  const soft: string[] = [];
  const languages: string[] = [];
  const tools: string[] = [];
  let summaryLines: string[] = [];

  let currentSection = "";
  for (const line of cleanLines) {
    const lower = line.toLowerCase();

    // Section headers — only exact/near-exact headers, not content lines
    if (/^(experience|work experience|employment|career)$/i.test(line)) {
      currentSection = "experience";
      continue;
    }
    if (/^(education|academic|degree|university|college)$/i.test(line)) {
      currentSection = "education";
      continue;
    }
    if (/^(certification|certifications|certificate|certificates|license|licenses|accreditation|accreditations|diploma|diplomas)$/i.test(line)) {
      currentSection = "certification";
      continue;
    }
    if (/^(project|projects|portfolio)$/i.test(line)) {
      currentSection = "project";
      continue;
    }
    if (/^(skill|skills|technologies|technical skills|competencies|proficiency)$/i.test(line)) {
      currentSection = "skills";
      continue;
    }
    if (/^(summary|about|profile|objective)$/i.test(line)) {
      currentSection = "summary";
      continue;
    }

    // Content accumulation (push raw data — Zod validates later)
    if (currentSection === "experience" && line.length > 15) {
      experience.push({ role: line.substring(0, 60), company: "", location: "", startDate: "", endDate: "", description: line, achievements: [] });
    } else if (currentSection === "education" && line.length > 5) {
      // Try to parse degree, institution, field, dates, grade from the line
      const degreeMatch = line.match(/(B\.?A\.?|M\.?A\.?|B\.?S\.?|M\.?S\.?|Ph\.?D\.?|M\.?B\.?A\.?|B\.?E\.?|M\.?E\.?|B\.?Tech\.?|M\.?Tech\.?|Bachelor|Master|Doctorate|Diploma|Certificate)/i);
      const yearMatch = line.match(/\b(19|20)\d{2}\b/);
      const gradeMatch = line.match(/(?:GPA|Grade|Score)[:\s]+([\d.]+\/?\d*)/i);
      const fieldMatch = line.match(/(?:in|of)\s+([A-Z][a-zA-Z\s&]+)(?:,|\.|$)/);
      education.push({
        degree: degreeMatch ? degreeMatch[0] : line,
        institution: "",
        field: fieldMatch ? fieldMatch[1].trim() : "",
        startDate: yearMatch && yearMatch.index && yearMatch.index < line.length / 2 ? yearMatch[0] : "",
        year: yearMatch ? yearMatch[0] : "",
        grade: gradeMatch ? gradeMatch[1] : "",
        details: "",
      });
    } else if (currentSection === "certification" && line.length > 5) {
      // Capture certification description (text after dash or on following lines)
      const clean = line.replace(/^[-*•]\s*/, "");
      const descMatch = clean.match(/(.+?)\s*(?:—|–|-)\s*(.+)/);
      certifications.push({
        name: descMatch ? descMatch[1].trim() : clean,
        issuer: "",
        year: "",
        description: descMatch ? descMatch[2].trim() : "",
      });
    } else if (currentSection === "project" && line.length > 10) {
      projects.push({ name: line.substring(0, 60), description: line, technologies: [] });
    } else if (currentSection === "skills") {
      for (const item of line.split(/[,;|]/).map((s) => s.trim()).filter((s) => s.length > 1)) {
        if (isTechnicalSkill(item)) technical.push(item);
        else if (isSoftSkill(item)) soft.push(item);
        else if (isLanguage(item)) languages.push(item);
        else tools.push(item);
      }
    } else if (currentSection === "summary" && line.length > 20) {
      summaryLines.push(line);
    }
  }

  // Only add sections to partialData if we found something
  // Only add sections to partialData if we found something
  if (experience.length) partialData.experience = experience.slice(0, 10);
  if (education.length) partialData.education = education.slice(0, 5);
  if (certifications.length) partialData.certifications = certifications.slice(0, 10);
  if (projects.length) partialData.projects = projects.slice(0, 10);
  if (summaryLines.length) {
    partialData.summary = summaryLines.join(" ").trim().substring(0, 500);
  } else if (rawProfile?.about) {
    partialData.summary = rawProfile.about.substring(0, 500);
  }

  const hasSkills = technical.length || soft.length || languages.length || tools.length;
  if (hasSkills) {
    partialData.skills = {
      technical: [...new Set(technical)].slice(0, 30),
      soft: [...new Set(soft)].slice(0, 15),
      languages: [...new Set(languages)].slice(0, 10),
      tools: [...new Set(tools)].slice(0, 20),
    };
  }

  // Let Zod do the structuring — .catch([]), .catch(""), and .default()
  // handle every missing field automatically.
  const jsonProfile = JsonProfileSchema.parse(partialData);

  // Use pre-detected domain if available; fall back to local detection
  const domain = preDetectedDomain || detectDomain(combinedText);

  log.info("FETCHER", `Fallback extraction complete | Name: ${jsonProfile.name || "(unknown)"} | Exp: ${jsonProfile.experience.length} | Edu: ${jsonProfile.education.length} | Domain: ${domain}`);
  return { jsonProfile, rawText: combinedText.substring(0, 8000), domain };
}

function isPromptInjectionLine(line: string): boolean {
  const l = line.toLowerCase().trim();

  return [
    /ignore\s+(all\s+)?previous\s+instructions/,
    /disregard\s+(the\s+)?system\s+prompt/,
    /you\s+are\s+now/,
    /reveal\s+your\s+system\s+prompt/,
    /show\s+your\s+system\s+prompt/,
    /increased\s+revenue\s+by\s+\d+%/,
  ].some((pattern) => pattern.test(l));
}
/** Domain-specific extraction hints injected into the AI system prompt. */
function getDomainExtractionHints(domain: string): string {
  const hints: Record<string, string> = {
    tech: `- Treat "tech stacks", "frameworks", "platforms" as technical skills
- Extract GitHub/portfolio URLs as projects
- Map "sprints", "releases", "deployments" to achievements`,
    legal: `- Treat "bar admissions", "court admissions" as certifications
- Map "cases", "matters", "deals" to project entries
- Extract "jurisdictions", "practice areas" as skills
- Map "clerking", "articles" to experience entries`,
    medical: `- Treat "rotations", "residencies", "fellowships" as experience entries
- Map "procedures", "surgeries", "diagnoses" to achievements
- Extract "specialties", "sub-specialties" as skills
- Treat "board certifications", "licenses" as certifications
- Map "clinical trials", "studies" to projects or publications`,
    creative: `- Treat "exhibitions", "shows", "performances" as projects
- Map "collections", "series", "volumes" to publications
- Extract "media", "mediums", "techniques" as skills
- Map "commissions", "gigs", "residencies" to experience entries`,
  };
  return hints[domain] ?? "";
}

function formatProfileText(profile: Awaited<ReturnType<typeof scrapeProfile>>): string {
  const parts: string[] = [];
  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.title) parts.push(`Title: ${profile.title}`);
  if (profile.about) parts.push(`\nAbout:\n${profile.about}`);
  if (profile.education?.length) parts.push(`\nEducation:\n${profile.education.map((e: string) => `- ${e}`).join("\n")}`);
  if (profile.experience?.length) parts.push(`\nExperience:\n${profile.experience.map((e: string) => `- ${e}`).join("\n")}`);
  if (profile.skills?.length) parts.push(`\nSkills:\n${profile.skills.join(", ")}`);
  if (profile.certifications?.length) parts.push(`\nCertifications:\n${profile.certifications.map((c: string) => `- ${c}`).join("\n")}`);
  if (profile.projects?.length) parts.push(`\nProjects:\n${profile.projects.map((p: string) => `- ${p}`).join("\n")}`);
  return parts.join("\n");
}

function isTechnicalSkill(s: string): boolean {
  const tech = ["javascript", "typescript", "python", "java", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin", "sql", "react", "angular", "vue", "node", "docker", "kubernetes", "aws", "azure", "gcp", "linux", "git", "html", "css", "mongodb", "postgres", "redis", "graphql", "rest", "api", "terraform", "jenkins", "ci/cd", "nginx", "apache", "django", "flask", "spring", "rails", "laravel", "next", "nuxt", "svelte", "tailwind", "bootstrap", "sass", "webpack", "vite", "pandas", "numpy", "tensorflow", "pytorch", "scikit", "spark", "hadoop", "kafka", "elasticsearch", "tableau", "powerbi", "figma", "sketch", "photoshop", "illustrator", "xd", "blender", "unity", "unreal", "machine learning", "deep learning", "nlp", "computer vision", "data science", "ai", "llm", "generative ai", "agentic ai", "rag"];
  return tech.some((t) => s.toLowerCase().includes(t));
}

function isSoftSkill(s: string): boolean {
  const soft = ["leadership", "communication", "teamwork", "problem solving", "critical thinking", "creativity", "adaptability", "time management", "negotiation", "presentation", "empathy", "conflict resolution", "decision making", "strategic thinking", "mentoring", "coaching", "facilitation", "stakeholder management", "project management", "agile", "scrum"];
  return soft.some((t) => s.toLowerCase().includes(t));
}

function isLanguage(s: string): boolean {
  const langs = ["english", "spanish", "french", "german", "italian", "portuguese", "chinese", "japanese", "korean", "arabic", "russian", "hindi", "dutch", "polish", "turkish", "native", "fluent", "conversational", "intermediate", "beginner", "bilingual", "multilingual"];
  return langs.some((t) => s.toLowerCase().includes(t));
}
