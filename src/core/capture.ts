import { randomUUID } from "node:crypto";
import type { CapturedRequestDTO, ReplayLogDTO } from "@/contracts/schemas";
import { getDb } from "@/db";
import { bins, capturedRequests, replayLogs } from "@/db/schema";
import { validateSafeExternalUrl } from "@/lib/ssrf";
import { eq } from "drizzle-orm";
import { publishCapturedRequest } from "./sse-broker";

export const MAX_BODY_BYTES = 512 * 1024;

const SENSITIVE_IP_HEADERS = new Set([
  "x-forwarded-for",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "forwarded",
  "x-client-ip",
  "x-cluster-client-ip",
]);

export function sanitizeHeaders(
  headers: Headers | Record<string, string>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  for (const [key, value] of entries) {
    const lower = key.toLowerCase();
    if (!SENSITIVE_IP_HEADERS.has(lower)) {
      sanitized[lower] = value;
    }
  }
  return sanitized;
}

export function extractQueryParams(url: string): Record<string, string> {
  const parsed = new URL(url, "http://localhost");
  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

export type CaptureOutcome =
  | {
      ok: true;
      status: number;
      body: string;
      contentType: string;
      captured: CapturedRequestDTO;
    }
  | { ok: false; status: 404 | 410 | 413; error: string };

export async function captureWebhookRequest(input: {
  binId: string;
  method: string;
  url: string;
  headers: Headers | Record<string, string>;
  bodyBytes: Uint8Array;
}): Promise<CaptureOutcome> {
  const db = getDb();
  const [bin] = await db
    .select()
    .from(bins)
    .where(eq(bins.id, input.binId))
    .limit(1);

  if (!bin) {
    return {
      ok: false,
      status: 404,
      error: `Bin '${input.binId}' no encontrado`,
    };
  }

  if (new Date(bin.expiresAt).getTime() <= Date.now()) {
    return {
      ok: false,
      status: 410,
      error: `Bin '${input.binId}' expirado (410 Gone)`,
    };
  }

  if (input.bodyBytes.byteLength > MAX_BODY_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Payload excede el límite de 512 KB (${input.bodyBytes.byteLength} bytes)`,
    };
  }

  const sanitizedHeaders = sanitizeHeaders(input.headers);
  const rawBody = Buffer.from(input.bodyBytes).toString("utf8");
  const parsedUrl = new URL(input.url, "http://localhost");
  const record: CapturedRequestDTO = {
    id: `req_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    binId: bin.id,
    method: input.method.toUpperCase(),
    path: parsedUrl.pathname,
    queryJson: JSON.stringify(extractQueryParams(input.url)),
    headersJson: JSON.stringify(sanitizedHeaders),
    rawBody,
    contentType: sanitizedHeaders["content-type"] ?? "text/plain",
    sizeBytes: input.bodyBytes.byteLength,
    receivedAt: new Date().toISOString(),
  };

  await db.insert(capturedRequests).values(record);
  publishCapturedRequest(bin.id, record);

  return {
    ok: true,
    status: bin.customResponseStatus,
    body: bin.customResponseBody,
    contentType: "application/json",
    captured: record,
  };
}

export type ReplayOutcome =
  | { ok: true; replay: ReplayLogDTO }
  | { ok: false; status: 400 | 404 | 502; error: string };

function buildForwardHeaders(
  rawHeaders: Record<string, string>,
): Record<string, string> {
  const blocked = new Set(["host", "content-length", "connection"]);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (!blocked.has(key.toLowerCase())) {
      out[key] = value;
    }
  }
  return out;
}

export async function replayCapturedRequest(input: {
  requestId: string;
  targetUrl: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<ReplayOutcome> {
  const db = getDb();
  const [original] = await db
    .select()
    .from(capturedRequests)
    .where(eq(capturedRequests.id, input.requestId))
    .limit(1);

  if (!original) {
    return {
      ok: false,
      status: 404,
      error: `Request '${input.requestId}' no encontrado`,
    };
  }

  const ssrf = await validateSafeExternalUrl(input.targetUrl);
  if (!ssrf.allowed || !ssrf.normalizedUrl) {
    return {
      ok: false,
      status: 400,
      error: ssrf.reason ?? "URL bloqueada por guard anti-SSRF",
    };
  }

  const method = (input.method ?? original.method).toUpperCase();
  const parsedHeaders =
    input.headers ??
    (JSON.parse(original.headersJson) as Record<string, string>);
  const forwardHeaders = buildForwardHeaders(parsedHeaders);
  const payload = input.body ?? original.rawBody;
  const allowBody = method !== "GET" && method !== "HEAD" && payload.length > 0;

  const startedAt = performance.now();
  try {
    const response = await fetch(ssrf.normalizedUrl, {
      method,
      headers: forwardHeaders,
      ...(allowBody ? { body: payload } : {}),
      signal: AbortSignal.timeout(8000),
    });
    const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const responseText = (await response.text()).slice(0, MAX_BODY_BYTES);
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const replay: ReplayLogDTO = {
      id: `rep_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      requestId: original.id,
      targetUrl: ssrf.normalizedUrl,
      responseStatus: response.status,
      responseHeadersJson: JSON.stringify(responseHeaders),
      responseBody: responseText,
      durationMs,
      replayedAt: new Date().toISOString(),
    };
    await db.insert(replayLogs).values(replay);
    return { ok: true, replay };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Replay request failed";
    return { ok: false, status: 502, error: msg };
  }
}
