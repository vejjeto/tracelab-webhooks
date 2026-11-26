import {
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const binsPg = pgTable("bins", {
  id: varchar("id", { length: 16 }).primaryKey(),
  name: text("name").notNull(),
  customResponseStatus: integer("custom_response_status")
    .notNull()
    .default(200),
  customResponseBody: text("custom_response_body")
    .notNull()
    .default('{"received":true,"service":"tracelab"}'),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const capturedRequestsPg = pgTable("captured_requests", {
  id: varchar("id", { length: 64 }).primaryKey(),
  binId: varchar("bin_id", { length: 16 })
    .notNull()
    .references(() => binsPg.id, { onDelete: "cascade" }),
  method: varchar("method", { length: 16 }).notNull(),
  path: text("path").notNull(),
  queryJson: text("query_json").notNull().default("{}"),
  headersJson: text("headers_json").notNull().default("{}"),
  rawBody: text("raw_body").notNull().default(""),
  contentType: text("content_type").notNull().default("application/json"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const replayLogsPg = pgTable("replay_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  requestId: varchar("request_id", { length: 64 })
    .notNull()
    .references(() => capturedRequestsPg.id, { onDelete: "cascade" }),
  targetUrl: text("target_url").notNull(),
  responseStatus: integer("response_status").notNull(),
  responseHeadersJson: text("response_headers_json").notNull().default("{}"),
  responseBody: text("response_body").notNull().default(""),
  durationMs: integer("duration_ms").notNull().default(0),
  replayedAt: timestamp("replayed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
