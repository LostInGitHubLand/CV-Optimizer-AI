import { Cluster } from "puppeteer-cluster";
import * as cheerio from "cheerio";

let cluster: Cluster | null = null;

async function getCluster(): Promise<Cluster> {
  if (!cluster) {
    cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: 2,
      puppeteerOptions: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      },
    });

    cluster.task(async ({ page, data: url }: { page: any; data: string }) => {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      const html = await page.content();
      return html;
    });
  }
  return cluster;
}

export interface ScrapedProfile {
  name: string;
  title: string;
  about: string;
  education: string[];
  experience: string[];
  skills: string[];
  certifications: string[];
  projects: string[];
  rawText: string;
  links: { url: string; text: string }[];
}

export async function scrapeProfile(url: string): Promise<ScrapedProfile> {
  try {
    const html = await fetchPageContent(url);
    const $ = cheerio.load(html);

    // Remove script and style elements
    $("script, style, noscript, iframe").remove();

    // Try to find "About" / "Who I Am" links
    const aboutLinks: string[] = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().toLowerCase().trim();
      if (
        text.includes("about") ||
        text.includes("who i am") ||
        text.includes("about me") ||
        text.includes("chi sono") ||
        text.includes("chi siamo") ||
        href.includes("about")
      ) {
        const fullUrl = href.startsWith("http")
          ? href
          : href.startsWith("/")
            ? new URL(href, url).toString()
            : "";
        if (fullUrl) aboutLinks.push(fullUrl);
      }
    });

    // Scrape about page if found
    let aboutText = "";
    if (aboutLinks.length > 0) {
      try {
        const aboutHtml = await fetchPageContent(aboutLinks[0]);
        const $about = cheerio.load(aboutHtml);
        $about("script, style, noscript, iframe").remove();
        aboutText = extractMainText($about);
      } catch {
        // ignore about page errors
      }
    }

    const mainText = extractMainText($);
    const rawText = aboutText
      ? `${aboutText}\n\n---PAGE CONTENT---\n\n${mainText}`
      : mainText;

    // Extract structured information
    const profile = await extractStructuredInfo(rawText, url);

    return {
      ...profile,
      rawText: rawText.substring(0, 15000),
      links: $("a")
        .map((_, el) => ({
          url: $(el).attr("href") || "",
          text: $(el).text().trim(),
        }))
        .get()
        .filter((l) => l.url && l.text)
        .slice(0, 20),
    };
  } catch (error) {
    console.error("Scraping error:", error);
    throw new Error(
      `Failed to scrape profile: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    if (html.length < 200) {
      // Fallback to puppeteer for JS-rendered pages
      const cl = await getCluster();
      return await cl.execute(url);
    }
    return html;
  } catch {
    // Fallback to puppeteer
    const cl = await getCluster();
    return await cl.execute(url);
  }
}

function extractMainText($: cheerio.CheerioAPI): string {
  // Try to find main content areas
  const selectors = [
    "main",
    "article",
    '[role="main"]',
    ".content",
    ".main-content",
    "#content",
    "#main",
    ".container",
    "body",
  ];

  let text = "";
  for (const sel of selectors) {
    const el = $(sel);
    if (el.length > 0) {
      text = el.text().trim();
      if (text.length > 500) break;
    }
  }

  // Clean up whitespace
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

/**
 * Pre-extract education and project sections from raw HTML text
 * using regex patterns before sending to AI.
 */
function preExtractEducation(text: string): string[] {
  const results: string[] = [];
  // Match education-related lines with degree keywords
  const eduPatterns = [
    /(?:^|\n)\s*(B\.?S\.?c?|M\.?S\.?c?|Ph\.?D\.?|MBA|B\.?A\.?|M\.?A\.?|B\.?E\.?|M\.?E\.?|B\.?Tech|M\.?Tech|Doctorate|Bachelor|Master|Diploma|Certificate)[^.\n]*(?:in|of)[^.\n]*/gmi,
    /(?:^|\n)\s*(?:University|College|Institute|School|Academy|Polytechnic)[^\n]*/gmi,
    /(?:^|\n)\s*(?:Bachelor|Master|Doctoral|Graduate|Undergraduate|Postgraduate)[^\n]*/gmi,
  ];
  for (const pattern of eduPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const cleaned = match.trim();
        if (cleaned.length > 5 && !results.includes(cleaned)) {
          results.push(cleaned);
        }
      }
    }
  }
  return results;
}

function preExtractProjects(text: string): string[] {
  const results: string[] = [];
  // Match project-related lines
  const projPatterns = [
    /(?:^|\n)\s*(?:Project|Portfolio|Case Study)["\s:]+([^\n]{10,200})/gmi,
    /(?:^|\n)\s*(?:Built|Developed|Created|Designed|Implemented)[^\n]*(?:app|application|system|platform|tool|website|API)[^\n]*/gmi,
    /(?:^|\n)\s*(?:GitHub|Repository|Open Source)["\s:]+([^\n]{10,200})/gmi,
  ];
  for (const pattern of projPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const cleaned = (match[1] || match[0]).trim();
      if (cleaned.length > 10 && !results.includes(cleaned)) {
        results.push(cleaned);
      }
    }
  }
  return results;
}

async function extractStructuredInfo(
  rawText: string,
  url: string
): Promise<Omit<ScrapedProfile, "rawText" | "links">> {
  const { chatWithOllamaJSON } = await import("../ai/ollama");

  const truncated = rawText.substring(0, 12000);

  // Pre-extract education and project hints
  const preEdu = preExtractEducation(rawText);
  const preProj = preExtractProjects(rawText);

  const systemPrompt = `You are an expert information extraction specialist. Extract structured profile information from raw webpage text. Be thorough and accurate.

EXTRACTION PRIORITIES:
- Education: Find ALL degrees, diplomas, certifications, courses, and institutions. Include the full degree name, institution, field of study, and year if available.
- Projects: Find ALL notable projects, portfolio items, open-source contributions, case studies, and significant work samples. Include project name, description, technologies used, and outcomes.
- Do NOT skip or summarize education entries — list each one individually.
- Do NOT skip or summarize project entries — list each one individually.`;

  const userPrompt = `Extract the person's professional profile from this webpage content.
URL: ${url}

${preEdu.length > 0 ? `PRE-EXTRACTED EDUCATION HINTS (verify and expand on these):\n${preEdu.join("\n")}\n\n` : ""}${preProj.length > 0 ? `PRE-EXTRACTED PROJECT HINTS (verify and expand on these):\n${preProj.join("\n")}\n\n` : ""}CONTENT:
${truncated}

Return JSON with these fields:
- name: person's full name (or empty string if not found)
- title: current job title or professional headline
- about: brief professional summary / bio
- education: array of education entries. Be EXHAUSTIVE — include every degree, diploma, certificate, course, and institution found. Format: "Degree in Field, Institution, Year"
- experience: array of work experience entries (role, company, period, description)
- skills: array of technical and professional skills
- certifications: array of certifications (name, issuer, year if available)
- projects: array of notable projects. Be EXHAUSTIVE — include every project, portfolio item, open-source contribution, and case study. Format: "Project Name: Description (technologies)"

IMPORTANT: Do NOT summarize or skip education entries. List each degree/certification separately.
IMPORTANT: Do NOT summarize or skip project entries. List each project separately.
If information is not found, use empty strings/arrays.`;

  try {
    const result = await chatWithOllamaJSON<{
      name: string;
      title: string;
      about: string;
      education: string[];
      experience: string[];
      skills: string[];
      certifications: string[];
      projects: string[];
    }>(systemPrompt, userPrompt);

    return {
      name: result.name || "",
      title: result.title || "",
      about: result.about || "",
      education: result.education || [],
      experience: result.experience || [],
      skills: result.skills || [],
      certifications: result.certifications || [],
      projects: result.projects || [],
    };
  } catch {
    // Fallback: return basic extraction
    return {
      name: "",
      title: "",
      about: truncated.substring(0, 500),
      education: [],
      experience: [],
      skills: [],
      certifications: [],
      projects: [],
    };
  }
}
