import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./shared/env";
import { getProgress } from "./cv-router";
import { JobStatus } from "./domain/workflow/job-status";
import { initDatabase } from "./infrastructure/db/connection";
import { getDb } from "./infrastructure/db/connection";
import { cvJobs } from "@db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

// Initialize database on startup
initDatabase();

// ── Startup Cleanup: reset DB and delete outputs ──
(async () => {
  try {
    const db = getDb();
    await db.delete(cvJobs);
    console.log("[BOOT] Cleared cv_jobs table");

    const outputsDir = path.resolve(process.cwd(), "outputs");
    try {
      const files = await fs.readdir(outputsDir);
      for (const file of files) {
        await fs.unlink(path.join(outputsDir, file));
      }
      console.log(`[BOOT] Deleted ${files.length} files from outputs/`);
    } catch {
      // outputs dir may not exist yet
    }
  } catch (err) {
    console.error("[BOOT] Cleanup error:", err);
  }
})();

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

// ── Direct file download routes ─────────────────────────────────
// These bypass tRPC and serve files directly with correct MIME types.
// They must be defined BEFORE the catch-all /api/* route.

app.get("/api/download/pdf/:jobId", async (c) => {
  const jobId = parseInt(c.req.param("jobId"));
  if (isNaN(jobId)) {
    return c.json({ error: "Invalid job ID" }, 400);
  }

  const db = getDb();
  const job = await db.query.cvJobs.findFirst({
    where: eq(cvJobs.id, jobId),
  });

  if (!job?.pdfPathOutput) {
    return c.json({ error: "PDF not ready" }, 404);
  }

  // Check if file is actually a PDF
  const ext = path.extname(job.pdfPathOutput).toLowerCase();
  const isPdf = ext === ".pdf";

  try {
    const fileBuffer = await fs.readFile(job.pdfPathOutput);

    if (isPdf) {
      return new Response(fileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="optimized-cv-${jobId}.pdf"`,
        },
      });
    } else {
      // Fallback: serve as HTML if PDF generation failed
      return new Response(fileBuffer, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="optimized-cv-${jobId}.html"`,
        },
      });
    }
  } catch {
    return c.json({ error: "File not found on disk" }, 404);
  }
});

app.get("/api/download/md/:jobId", async (c) => {
  const jobId = parseInt(c.req.param("jobId"));
  if (isNaN(jobId)) {
    return c.json({ error: "Invalid job ID" }, 400);
  }

  const db = getDb();
  const job = await db.query.cvJobs.findFirst({
    where: eq(cvJobs.id, jobId),
  });

  if (!job?.markdownOutput) {
    return c.json({ error: "Markdown not ready" }, 404);
  }

  return new Response(job.markdownOutput, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="optimized-cv-${jobId}.md"`,
    },
  });
});

// SSE endpoint for job progress — persistent until client disconnects or job completes
app.get("/api/progress/:jobId", async (c) => {
  const jobId = parseInt(c.req.param("jobId"));
  if (isNaN(jobId)) {
    return c.json({ error: "Invalid job ID" }, 400);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastSent = "";

      const safeClose = () => {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      const sendEvent = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // stream closed
        }
      };

      // Helper: read from memory first, fall back to DB
      // strategyData is stored as a JSON string in cache — must parse it for the frontend
      const parseStrategyData = (raw: string | undefined): Record<string, unknown> | undefined => {
        if (!raw) return undefined;
        try { return JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
      };

      const readProgress = async () => {
        const memory = getProgress(jobId);
        if (memory) {
          // Normalize: strategyData may be a string in cache, frontend needs object
          return {
            status: memory.status,
            currentAgent: memory.currentAgent,
            agentMessage: memory.agentMessage,
            strategyData: parseStrategyData(memory.strategyData),
            designState: memory.designState,
          };
        }
        // Fallback: query DB when memory entry is cleaned up
        const rows = await getDb()
          .select({
            status: cvJobs.status,
            currentAgent: cvJobs.currentAgent,
            agentMessage: cvJobs.agentMessage,
            jsonStrategy: cvJobs.jsonStrategy,
          })
          .from(cvJobs)
          .where(eq(cvJobs.id, jobId))
          .limit(1);
        if (!rows.length) return null;
        const row = rows[0];
        // Parse jsonStrategy from DB into strategyData for the frontend
        let strategyData: Record<string, unknown> | undefined;
        try {
          if (row.jsonStrategy && typeof row.jsonStrategy === "string") {
            strategyData = JSON.parse(row.jsonStrategy) as Record<string, unknown>;
          }
        } catch {
          strategyData = undefined;
        }
        return {
          status: row.status,
          currentAgent: row.currentAgent,
          agentMessage: row.agentMessage,
          strategyData,
        };
      };

      // Send initial state immediately
      const initial = await readProgress();
      if (initial) {
        lastSent = JSON.stringify(initial);
        sendEvent(initial);
      }

      // Poll for updates every 800ms — only send if data changed
      const interval = setInterval(() => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        readProgress().then((currentProgress) => {
          if (!currentProgress || closed) return;
          const serialized = JSON.stringify(currentProgress);
          if (serialized !== lastSent) {
            lastSent = serialized;
            sendEvent(currentProgress);
          }
          if (
            currentProgress.status === JobStatus.Completed ||
            currentProgress.status === JobStatus.Error
          ) {
            // Keep sending for 3 more seconds so client sees final state, then close
            setTimeout(() => {
              safeClose();
            }, 3000);
          }
        });
      }, 800);

      // Heartbeat every 25 seconds to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(":heartbeat\n\n"));
        } catch {
          safeClose();
        }
      }, 25000);

      // No hard timeout — connection stays alive until:
      // 1. The job reaches completed/error status (with 3s grace)
      // 2. The client disconnects
      // 3. The server restarts
      // NOTE: awaiting_review does NOT close the stream — user may start
      // refinement from that state, and WRITER_REFINE/DESIGNER_REFINE
      // events must be streamable.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// tRPC handler
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});

app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStatic } = await import("@hono/node-server/serve-static");
  const path = await import("path");
  const fs = await import("fs");

  // Serve static files from dist/public
  app.use("*", serveStatic({ root: "./dist/public" }));

  // SPA fallback: serve index.html for non-API routes
  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const distPath = path.resolve(import.meta.dirname, "../dist/public");
    const indexPath = path.resolve(distPath, "index.html");
    const content = fs.readFileSync(indexPath, "utf-8");
    return c.html(content);
  });

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
