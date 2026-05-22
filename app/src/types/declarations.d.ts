declare module "better-sqlite3" {
  class Database {
    constructor(filename: string);
    pragma(source: string, options?: { simple?: boolean }): unknown;
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
  }
  class Statement {
    run(...params: unknown[]): { lastInsertRowid: number | bigint; changes: number };
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  }
  export = Database;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(dataBuffer: Buffer): Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
  export default pdfParse;
}
