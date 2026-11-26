import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bins = sqliteTable("bins", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  customResponseStatus: integer("custom_response_status")
    .notNull()
    .default(200),
  customResponseBody: text("custom_response_body")
    .notNull()
    .default('{"received":true,"service":"tracelab"}'),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const capturedRequests = sqliteTable("captured_requests", {
  id: text("id").primaryKey(),
  binId: text("bin_id")
    .notNull()
    .references(() => bins.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  path: text("path").notNull(),
  queryJson: text("query_json").notNull().default("{}"),
  headersJson: text("headers_json").notNull().default("{}"),
  rawBody: text("raw_body").notNull().default(""),
  contentType: text("content_type").notNull().default("application/json"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  receivedAt: text("received_at").notNull(),
});

export const replayLogs = sqliteTable("replay_logs", {
  id: text("id").primaryKey(),
  requestId: text("request_id")
    .notNull()
    .references(() => capturedRequests.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  responseStatus: integer("response_status").notNull(),
  responseHeadersJson: text("response_headers_json").notNull().default("{}"),
  responseBody: text("response_body").notNull().default(""),
  durationMs: integer("duration_ms").notNull().default(0),
  replayedAt: text("replayed_at").notNull(),
});

export type BinRow = typeof bins.$inferSelect;
export type NewBinRow = typeof bins.$inferInsert;
export type CapturedRequestRow = typeof capturedRequests.$inferSelect;
export type NewCapturedRequestRow = typeof capturedRequests.$inferInsert;
export type ReplayLogRow = typeof replayLogs.$inferSelect;
export type NewReplayLogRow = typeof replayLogs.$inferInsert;
