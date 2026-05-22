declare module "better-sqlite3" {
  interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
    verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
    nativeBinding?: string;
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  class Statement {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  }

  class Database {
    constructor(filename: string, options?: DatabaseOptions);
    pragma(source: string, options?: { simple?: boolean }): unknown;
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
  }

  export = Database;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    version: string;
    metadata: Record<string, unknown> | null;
  }

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;

  export = pdfParse;
}
