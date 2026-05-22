export interface FabricationIssue {
  category: "invented_metric" | "winner_distortion" | "coach_distortion" | "unsupported_claim";
  severity: "minor" | "major" | "critical";
  text: string;
}

const METRIC_PATTERNS = [
  /\b\d+(\.\d+)?\s?%/gi,
  /\$\s?\d[\d,.]*(k|m|bn|b)?\b/gi,
  /\b(team of|managed|led)\s+\d+\b/gi,
  /\b\d+(\.\d+)?x\b/gi,
  /\b\d+(\.\d+)?\s?(users|clients|customers|revenue|growth|uptime|accuracy|reduction|increase)\b/gi,
];

export function collectFabricationIssues(sourceText: string, outputText: string): FabricationIssue[] {
  const issues: FabricationIssue[] = [];
  const source = sourceText.toLowerCase();
  const output = outputText.toLowerCase();

  for (const pattern of METRIC_PATTERNS) {
    const matches = outputText.match(pattern) ?? [];
    for (const match of matches) {
      if (!source.includes(match.toLowerCase())) {
        issues.push({ category: "invented_metric", severity: "major", text: match });
      }
    }
  }
  if (source.includes("finalist") && output.includes("winner")) {
    issues.push({ category: "winner_distortion", severity: "critical", text: "finalist became winner" });
  }
  if ((source.includes("coach") || source.includes("trainer")) && /award\s+(winner|recipient)|won\s+.*award/i.test(outputText)) {
    issues.push({ category: "coach_distortion", severity: "critical", text: "coach/trainer became award recipient" });
  }
  return issues;
}

export function expectNoFabrication(sourceText: string, outputText: string) {
  expect(collectFabricationIssues(sourceText, outputText)).toEqual([]);
}
