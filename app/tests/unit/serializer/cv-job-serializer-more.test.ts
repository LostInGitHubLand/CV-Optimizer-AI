import { describe, expect, it } from "vitest";
import { safeJsonParse, serializeCvJob, toDbUpdate } from "../../../api/application/serializers/cv-job-serializer";
import { JobStatus } from "../../../api/domain/workflow/job-status";

function baseDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    inputType: "pdf",
    sourceUrl: null,
    pdfPath: null,
    rawText: null,
    updates: null,
    jobAdvert: null,
    domain: null,
    status: JobStatus.AwaitingReview,
    currentState: "main",
    version: 1,
    sessionId: "s1",
    currentAgent: null,
    agentMessage: null,
    jsonProfile: null,
    jsonStrategy: null,
    jsonCv: null,
    designComposition: null,
    designState: null,
    fetcherOutput: null,
    analystOutput: null,
    writerOutput: null,
    markdownOutput: null,
    htmlOutput: null,
    pdfPathOutput: null,
    errorMessage: null,
    backupJsonCv: null,
    backupMarkdown: null,
    backupHtml: null,
    backupPdfPath: null,
    backupDesignComposition: null,
    backupDesignState: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as any;
}

describe("cv-job serializer", () => {
  it("safeJsonParse returns objects and rejects malformed or scalar JSON", () => {
    expect(safeJsonParse('{"ok":true}')).toEqual({ ok: true });
    expect(safeJsonParse("[1,2]")).toEqual([1, 2]);
    expect(safeJsonParse("bad-json")).toBeNull();
    expect(safeJsonParse(null)).toBeNull();
  });

  it("toDbUpdate serializes JSON and composition-native design fields", () => {
    const db = toDbUpdate({
      status: JobStatus.Refining,
      currentAgent: "WRITER_REFINE",
      jsonProfile: { name: "Alex" },
      jsonStrategy: { strategy: { tone: "professional" } },
      jsonCv: { name: "Alex", sections: [] },
      designComposition: { layoutId: "single-column", themeId: "minimal-swiss" } as any,
      backupDesignComposition: { layoutId: "sidebar-left", themeId: "technical-dark" } as any,
    });

    expect(db.status).toBe(JobStatus.Refining);
    expect(db.currentAgent).toBe("WRITER_REFINE");
    expect(JSON.parse(db.jsonProfile as string)).toEqual({ name: "Alex" });
    expect(JSON.parse(db.jsonCv as string)).toEqual({ name: "Alex", sections: [] });
    expect(JSON.parse(db.designComposition as string).layoutId).toBe("single-column");
    expect(JSON.parse(db.backupDesignComposition as string).layoutId).toBe("sidebar-left");
  });

  it("serializeCvJob exposes hasBackup and reconstructs backup design composition", () => {
    const row = baseDbRow({
      backupMarkdown: "# previous cv",
      backupDesignComposition: JSON.stringify({
        layoutId: "sidebar-right",
        themeId: "minimal-swiss",
        sectionLayout: { main: ["summary"], sidebar: ["contacts"] },
        sectionVariants: {},
        sectionDataOverrides: {},
        semanticState: {},
        renderingOverrides: {},
      }),
    });

    const job = serializeCvJob(row);

    expect(job.hasBackup).toBe(true);
    expect(job.backupMarkdown).toBe("# previous cv");
    expect(job.backupDesignComposition?.layoutId).toBe("sidebar-right");
  });
});
