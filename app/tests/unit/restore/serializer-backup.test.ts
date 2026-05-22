import { describe, expect, it } from "vitest";
import { serializeCvJob } from "../../../api/application/serializers/cv-job-serializer";

describe("CvJob serializer backup fields", () => {
  it("exposes hasBackup and reconstructs backup DesignComposition", () => {
    const row: any = {
      id: 1, inputType: "pdf", sourceUrl: null, pdfPath: null, rawText: null, updates: null, jobAdvert: null, domain: "tech", status: "awaiting_review", currentState: "main", version: 1, sessionId: "sess", currentAgent: "", agentMessage: "",
      jsonProfile: null, jsonStrategy: null, jsonCv: null, designComposition: null, designState: null, fetcherOutput: null, analystOutput: null, writerOutput: null, markdownOutput: "current", htmlOutput: "<html>current</html>", pdfPathOutput: "/tmp/current.pdf", errorMessage: null,
      backupJsonCv: JSON.stringify({ name: "Previous" }), backupMarkdown: "previous markdown", backupHtml: "<html>previous</html>", backupPdfPath: "/tmp/previous.pdf",
      backupDesignComposition: JSON.stringify({ layoutId: "sidebar-left", themeId: "minimal-swiss", sectionLayout: { main: ["summary"], sidebar: ["contacts"] }, sectionVariants: {}, sectionDataOverrides: {}, semanticState: {}, renderingOverrides: {} }),
      backupDesignState: null, createdAt: new Date(), updatedAt: new Date(),
    };
    const job = serializeCvJob(row);
    expect(job.hasBackup).toBe(true);
    expect(job.backupMarkdown).toBe("previous markdown");
    expect(job.backupDesignComposition?.layoutId).toBe("sidebar-left");
  });
});
