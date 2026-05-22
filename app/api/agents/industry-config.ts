/**
 * IndustryConfig — The "Domain Map"
 *
 * Centralised configuration for all four professional domains.
 * No industry-specific strings live in agent code; everything is
 * looked up here at runtime.
 */

export type Domain = "tech" | "legal" | "medical" | "creative" | "unknown";

interface DomainConfig {
  /** Display label */
  label: string;
  /** Keywords for domain detection (stemmed at runtime) */
  detectionKeywords: string[];
  /** Skill categories and their member skills (stemmed roots) */
  skillCategories: Record<string, string[]>;
  /** Certification regex patterns → strategic reason */
  certificationPatterns: Array<{ pattern: string; reason: string }>;
  /** Project relevance patterns → strategic reason */
  projectPatterns: Array<{ pattern: string; reason: string }>;
  /** Tone guidance for the Writer */
  tone: string;
  /** Power verbs for bullet-point rewriting */
  powerVerbs: string[];
  /** Smart-pruning priority: sections ranked by domain importance (first = most important) */
  sectionPriority: string[];
  /** Generic label used in reason fields (domain-neutral) */
  competencyLabel: string;
  /** Common role titles for role guessing */
  roleTitles: string[];
}

export const IndustryConfig: Record<Exclude<Domain, "unknown">, DomainConfig> = {
  tech: {
    label: "Technology & Engineering",
    detectionKeywords: [
      "software", "engineer", "developer", "programming", "code", "fullstack", "frontend", "backend",
      "devops", "cloud", "ai", "machine learning", "data", "api", "agile", "scrum", "sre", "security",
      "blockchain", "web3", "mobile", "ios", "android", "system", "architecture", "database",
    ],
    skillCategories: {
      "Core Engineering": ["program", "code", "develop", "engineer", "architect", "debug", "deploy"],
      "Cloud & Infrastructure": ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd", "devops"],
      "Data & AI": ["machine learn", "deep learn", "nlp", "computer vision", "data scienc", "tensor", "pytorch", "llm", "rag", "agentic"],
      "Frontend & Design": ["react", "angular", "vue", "css", "ui/ux", "accessibility", "responsive"],
      "Soft Skills": ["leadership", "communicat", "collaborat", "problem solv", "mentor"],
    },
    certificationPatterns: [
      { pattern: "aws|azure|gcp|google cloud", reason: "Cloud platform certification directly relevant" },
      { pattern: "kubernetes|docker|devops|ci\\s*/?\\s*cd", reason: "DevOps / containerisation certification directly relevant" },
      { pattern: "security|cyber|penetration|ceh|oscp|cissp", reason: "Cybersecurity certification directly relevant" },
      { pattern: "scrum|agile|safe|pmp", reason: "Agile / project management certification" },
      { pattern: "tensor|pytorch|huggingface|ml|data", reason: "ML / data science certification" },
    ],
    projectPatterns: [
      { pattern: "ai|ml|machine\\s*learn|deep\\s*learn|llm|rag", reason: "AI/ML project demonstrating algorithmic depth" },
      { pattern: "web|frontend|backend|fullstack|api|microservice", reason: "Full-stack engineering project" },
      { pattern: "mobile|ios|android|react\\s*native|flutter", reason: "Mobile development project" },
      { pattern: "data|pipeline|etl|warehouse|spark", reason: "Data engineering project" },
    ],
    tone: "impact-oriented, concise, quantified where possible using ONLY existing data",
    powerVerbs: ["Engineered", "Architected", "Shipped", "Scaled", "Optimized", "Automated", "Debugged", "Deployed", "Refactored", "Led"],
    sectionPriority: ["experience", "skills", "projects", "certifications", "education", "publications", "awards", "volunteer", "interests"],
    competencyLabel: "Core Competency",
    roleTitles: ["Engineer", "Developer", "Architect", "Manager", "Lead", "Principal", "Staff", "CTO", "VP of Engineering", "Director"],
  },

  legal: {
    label: "Legal & Compliance",
    detectionKeywords: [
      "attorney", "lawyer", "solicitor", "counsel", "litigation", "compliance", "regulatory",
      "contract", "statute", "legislation", "jurisprudence", "bar", "law", "legal", "court",
      "dispute", "arbitration", "mediation", "due diligence", "mergers", "acquisition", "ip",
      "patent", "trademark", "copyright", "gdpr", "privacy",
    ],
    skillCategories: {
      "Legal Practice": ["litigat", "draft", "negotiat", "advocat", "counsel", "advis"],
      "Compliance & Regulatory": ["complianc", "regulat", "gdpr", "risk", "audit", "governanc"],
      "Corporate & Commercial": ["merger", "acquisit", "due diligen", "contract", "corporat"],
      "IP & Research": ["patent", "trademark", "copyright", "legal research", "case law"],
      "Soft Skills": ["analysi", "communicat", "negotiat", "attention to detail", "ethic"],
    },
    certificationPatterns: [
      { pattern: "bar|admitted|admission|solicitor", reason: "Bar admission — essential legal credential" },
      { pattern: "llm|jd|juris doctor|doctor of law", reason: "Advanced legal degree" },
      { pattern: "cpa|cisa|cipp|cipm", reason: "Compliance / privacy certification directly relevant" },
      { pattern: "notary|mediat|arbitrat", reason: "Alternative dispute resolution credential" },
    ],
    projectPatterns: [
      { pattern: "litigation|case|trial|appeal", reason: "Litigation matter demonstrating courtroom experience" },
      { pattern: "merger|acquisition|m&a|due diligen", reason: "Transactional project demonstrating deal expertise" },
      { pattern: "compliance|regulatory|gdpr|audit", reason: "Compliance project demonstrating regulatory knowledge" },
      { pattern: "contract|draft|negotiat", reason: "Contract project demonstrating drafting skill" },
    ],
    tone: "formal, precise, authoritative, with measured confidence",
    powerVerbs: ["Advised", "Drafted", "Negotiated", "Litigated", "Advocated", "Mediated", "Arbitrated", "Reviewed", "Structured", "Championed"],
    sectionPriority: ["experience", "certifications", "education", "skills", "publications", "awards", "projects", "volunteer", "interests"],
    competencyLabel: "Legal Competency",
    roleTitles: ["Associate", "Partner", "Counsel", "Of Counsel", "Senior Associate", "Junior Associate", "Paralegal", "Clerk", "Judge", "Magistrate", "Arbitrator"],
  },

  medical: {
    label: "Medical & Healthcare",
    detectionKeywords: [
      "physician", "doctor", "nurse", "surgeon", "clinician", "clinical", "patient", "diagnosis",
      "treatment", "therapy", "pharmaceutical", "medical", "healthcare", "hospital", "surgery",
      "radiology", "pathology", "cardiology", "oncology", "pediatric", "orthopedic", "anesthesi",
      "emergency", "icu", "primary care", "specialist", "resident", "fellow", "attending",
    ],
    skillCategories: {
      "Clinical Practice": ["diagnos", "treat", "surg", "procedur", "patient care", "examin"],
      "Pharmacology": ["pharmacolog", "prescript", "drug", "medication", "dosag", "formular"],
      "Research & Evidence": ["clinical trial", "evidence-based", "research", "biostat", "epidemiolog"],
      "Technology & Imaging": ["radiolog", "mri", "ct", "ultrasound", "ehr", "telemedicin"],
      "Soft Skills": ["empathi", "communicat", "teamwork", "stress manag", "ethic", "compassion"],
    },
    certificationPatterns: [
      { pattern: "board certified|board certifi|facs|faap|facp|facc", reason: "Board certification — essential medical credential" },
      { pattern: "md|do|mbbs|bds|dvm|pharmd", reason: "Medical degree — core qualification" },
      { pattern: "rn|np|pa|cna|crna", reason: "Nursing / practitioner certification" },
      { pattern: "acls|bls|pals|atls", reason: "Emergency life-support certification" },
      { pattern: "cme|continuing medical", reason: "Continuing medical education — up-to-date knowledge" },
    ],
    projectPatterns: [
      { pattern: "clinical trial|study|research|publication", reason: "Clinical research demonstrating evidence-based practice" },
      { pattern: "surgery|procedur|operat", reason: "Surgical project demonstrating procedural expertise" },
      { pattern: "quality improvement|qi|patient safet", reason: "Quality improvement initiative demonstrating systems thinking" },
      { pattern: "ehr|emr|health informatic|telemedicin", reason: "Health IT project demonstrating technology adoption" },
    ],
    tone: "clinical yet compassionate, evidence-based, patient-centered language",
    powerVerbs: ["Diagnosed", "Treated", "Operated", "Managed", "Collaborated", "Researched", "Published", "Led", "Educated", "Advocated"],
    sectionPriority: ["experience", "certifications", "publications", "education", "skills", "projects", "awards", "volunteer", "interests"],
    competencyLabel: "Clinical Competency",
    roleTitles: ["Attending", "Resident", "Fellow", "Physician", "Surgeon", "Nurse", "Practitioner", "Specialist", "Consultant", "Director of Medicine", "Chief of Staff"],
  },

  creative: {
    label: "Creative & Humanities",
    detectionKeywords: [
      "designer", "artist", "writer", "editor", "curator", "creative", "art director", "copywriter",
      "illustrator", "photographer", "filmmaker", "musician", "producer", "journalist", "author",
      "translator", "historian", "philosopher", "linguist", "anthropologist", "sociologist",
      "ux designer", "graphic designer", "motion designer", "brand", "content", "storytelling",
      "exhibition", "portfolio", "gallery", "museum", "theatre", "performance",
    ],
    skillCategories: {
      "Visual & Design": ["typograph", "color theori", "layout", "branding", "illustr", "photographi", "motion"],
      "Writing & Content": ["copywrit", "edit", "journal", "storytel", "content strategi", "seo"],
      "UX & Digital": ["user research", "wirefram", "prototyp", "usability", "figma", "sketch"],
      "Arts & Performance": ["direct", "curat", "perform", "compos", "conduct"],
      "Soft Skills": ["creativ", "collaborat", "communicat", "adaptabl", "critiqu"],
    },
    certificationPatterns: [
      { pattern: "adobe certified|ace|aca", reason: "Adobe certification — core creative tool credential" },
      { pattern: "google analytics|hubspot|content market", reason: "Digital marketing certification" },
      { pattern: "pmp|scrum|agil", reason: "Project management certification" },
    ],
    projectPatterns: [
      { pattern: "campaign|brand|identity|rebrand", reason: "Branding campaign demonstrating creative vision" },
      { pattern: "exhibition|gallery|museum|show", reason: "Exhibition project demonstrating curation skill" },
      { pattern: "publication|book|article|series", reason: "Published work demonstrating writing authority" },
      { pattern: "portfolio|collection|body of work", reason: "Portfolio project demonstrating range and depth" },
    ],
    tone: "narrative, evocative, showing process and intent behind outcomes",
    powerVerbs: ["Created", "Designed", "Directed", "Authored", "Curated", "Composed", "Illustrated", "Produced", "Conceptualised", "Crafted"],
    sectionPriority: ["experience", "projects", "skills", "education", "publications", "awards", "certifications", "volunteer", "interests"],
    competencyLabel: "Creative Competency",
    roleTitles: ["Designer", "Art Director", "Writer", "Editor", "Curator", "Producer", "Manager", "Lead", "Senior", "Junior", "Freelance"],
  },
};

/** All domains except "unknown" as an array for iteration. */
export const DOMAINS: Array<Exclude<Domain, "unknown">> = ["tech", "legal", "medical", "creative"];

/**
 * classifySkill — map a raw skill string to a domain-appropriate category.
 * Uses the skillCategories configuration from IndustryConfig.
 */
export function classifySkill(skill: string, domain?: Domain): string {
  const lower = skill.toLowerCase().trim();
  if (!lower) return "Skills";

  // Try domain-specific categories first
  if (domain && domain !== "unknown") {
    const cfg = IndustryConfig[domain];
    if (cfg?.skillCategories) {
      for (const [catName, keywords] of Object.entries(cfg.skillCategories)) {
        for (const kw of keywords) {
          if (lower.includes(kw.toLowerCase())) return catName;
        }
      }
    }
  }

  // Fallback: try all domains
  for (const d of DOMAINS) {
    const cfg = IndustryConfig[d];
    for (const [catName, keywords] of Object.entries(cfg.skillCategories)) {
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) return catName;
      }
    }
  }

  // Default category
  return "General Skills";
}
