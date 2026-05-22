/**
 * Structured Logger — Production-grade logging with context, performance tracking,
 * and standardized output format.
 *
 * Usage:
 *   const log = logger({ jobId: 42, sessionId: "abc" });
 *   log.info("FETCHER", "Extraction complete", timer);
 *   // → [2026-01-15T09:23:45.123Z] [INFO] [42] [abc] [FETCHER] - Extraction complete (Latency: 847ms)
 */

type LogLevel = "info" | "warn" | "error";

interface LoggerContext {
  jobId?: number | string;
  sessionId?: string;
}

interface AgentTimer {
  start: number;
  agent: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORMATTER
   ═══════════════════════════════════════════════════════════════════════════ */

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatLog(
  level: LogLevel,
  ctx: LoggerContext,
  agent: string,
  message: string,
  latencyMs?: number
): string {
  const parts: string[] = [
    `[${formatTimestamp()}]`,
    `[${level.toUpperCase()}]`,
    ctx.jobId !== undefined ? `[Job:${ctx.jobId}]` : "[-]",
    ctx.sessionId ? `[Sess:${ctx.sessionId}]` : "[-]",
    `[${agent}]`,
    "-",
    message,
  ];
  if (latencyMs !== undefined) {
    parts.push(`(Latency: ${Math.round(latencyMs)}ms)`);
  }
  return parts.join(" ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   HIGH-RESOLUTION TIMER
   ═══════════════════════════════════════════════════════════════════════════ */

/** Start a performance timer for an agent call. Call `stop()` to get elapsed ms. */
export function startTimer(agent: string): AgentTimer {
  return { start: performance.now(), agent };
}

/** Stop a timer and return elapsed milliseconds. */
export function stopTimer(timer: AgentTimer): number {
  return performance.now() - timer.start;
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGGER FACTORY
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Logger {
  /** Info-level log. Use for normal operation events. */
  info: (agent: string, message: string, timer?: AgentTimer) => void;
  /** Warn-level log. Use for recoverable issues (fallback triggered, degraded mode). */
  warn: (agent: string, message: string, timer?: AgentTimer) => void;
  /** Error-level log. Use for failures that require operator attention. */
  error: (agent: string, message: string, timer?: AgentTimer) => void;
  /** Create a child logger with additional context fields. */
  child: (extra: LoggerContext) => Logger;
}

export function logger(ctx: LoggerContext = {}): Logger {
  function log(level: LogLevel, agent: string, message: string, timer?: AgentTimer) {
    const latency = timer ? stopTimer(timer) : undefined;
    const line = formatLog(level, ctx, agent, message, latency);
    switch (level) {
      case "info":
        console.log(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "error":
        console.error(line);
        break;
    }
  }

  return {
    info: (agent, message, timer) => log("info", agent, message, timer),
    warn: (agent, message, timer) => log("warn", agent, message, timer),
    error: (agent, message, timer) => log("error", agent, message, timer),
    child: (extra) => logger({ ...ctx, ...extra }),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONVENIENCE: module-level default logger (no context)
   ═══════════════════════════════════════════════════════════════════════════ */

export const defaultLogger: Logger = logger();
