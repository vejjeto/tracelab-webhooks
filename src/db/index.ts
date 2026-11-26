import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS bins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  custom_response_status INTEGER NOT NULL DEFAULT 200,
  custom_response_body TEXT NOT NULL DEFAULT '{"received":true,"service":"tracelab"}',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS captured_requests (
  id TEXT PRIMARY KEY,
  bin_id TEXT NOT NULL REFERENCES bins(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  query_json TEXT NOT NULL DEFAULT '{}',
  headers_json TEXT NOT NULL DEFAULT '{}',
  raw_body TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'application/json',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  received_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_captured_requests_bin_received
  ON captured_requests (bin_id, received_at DESC);

CREATE TABLE IF NOT EXISTS replay_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES captured_requests(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_headers_json TEXT NOT NULL DEFAULT '{}',
  response_body TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  replayed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_replay_logs_request_replayed
  ON replay_logs (request_id, replayed_at DESC);
`;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

const globalDbState = globalThis as unknown as {
  __tracelabSqlite?: DatabaseSync | undefined;
  __tracelabDb?: DbInstance | undefined;
  __tracelabDbPath?: string | undefined;
};

function resolveDbPath(): string {
  return (
    process.env.TRACELAB_DB_PATH ||
    path.resolve(process.cwd(), "data/tracelab.db")
  );
}

function createSqliteClient(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec(SCHEMA_SQL);
  return sqlite;
}

function createDrizzleProxy(sqlite: DatabaseSync): DbInstance {
  return drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      const args = params as SQLInputValue[];
      if (method === "run") {
        stmt.run(...args);
        return { rows: [] };
      }
      if (method === "get") {
        stmt.setReturnArrays(true);
        const row = stmt.get(...args);
        return { rows: (row ?? undefined) as unknown as unknown[] };
      }
      stmt.setReturnArrays(true);
      return { rows: stmt.all(...args) as unknown as unknown[][] };
    },
    { schema },
  );
}

export function getDb(): DbInstance {
  const targetPath = resolveDbPath();
  if (
    !globalDbState.__tracelabDb ||
    globalDbState.__tracelabDbPath !== targetPath
  ) {
    if (globalDbState.__tracelabSqlite) {
      globalDbState.__tracelabSqlite.close();
    }
    const sqlite = createSqliteClient(targetPath);
    globalDbState.__tracelabSqlite = sqlite;
    globalDbState.__tracelabDb = createDrizzleProxy(sqlite);
    globalDbState.__tracelabDbPath = targetPath;
  }
  return globalDbState.__tracelabDb;
}

export function getSqlite(): DatabaseSync {
  getDb();
  return globalDbState.__tracelabSqlite!;
}

export function ensureSchema(): void {
  getSqlite().exec(SCHEMA_SQL);
}

export function closeDb(): void {
  if (globalDbState.__tracelabSqlite) {
    globalDbState.__tracelabSqlite.close();
    globalDbState.__tracelabSqlite = undefined;
    globalDbState.__tracelabDb = undefined;
    globalDbState.__tracelabDbPath = undefined;
  }
}
