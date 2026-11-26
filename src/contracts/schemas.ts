import { z } from "zod";

export const HttpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

export const CreateBinSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Webhook Bin"),
  customResponseStatus: z.number().int().min(100).max(599).default(200),
  customResponseBody: z
    .string()
    .max(16_384)
    .default('{"received":true,"service":"tracelab"}'),
  ttlHours: z.number().int().min(1).max(168).default(24),
});

export const UpdateBinSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  customResponseStatus: z.number().int().min(100).max(599).optional(),
  customResponseBody: z.string().max(16_384).optional(),
});

export const ReplayRequestSchema = z.object({
  targetUrl: z.string().trim().url("La URL destino debe ser válida"),
  method: HttpMethodSchema.optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

export const VerifyHmacSchema = z.object({
  payload: z.string(),
  signatureHeader: z.string().min(1),
  secret: z.string().min(1),
});

export interface BinDTO {
  id: string;
  name: string;
  customResponseStatus: number;
  customResponseBody: string;
  expiresAt: string;
  createdAt: string;
  requestCount?: number;
}

export interface CapturedRequestDTO {
  id: string;
  binId: string;
  method: string;
  path: string;
  queryJson: string;
  headersJson: string;
  rawBody: string;
  contentType: string;
  sizeBytes: number;
  receivedAt: string;
}

export interface ReplayLogDTO {
  id: string;
  requestId: string;
  targetUrl: string;
  responseStatus: number;
  responseHeadersJson: string;
  responseBody: string;
  durationMs: number;
  replayedAt: string;
}
