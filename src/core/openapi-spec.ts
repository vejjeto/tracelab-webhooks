import {
  CreateBinSchema,
  ReplayRequestSchema,
  UpdateBinSchema,
  VerifyHmacSchema,
} from "@/contracts/schemas";
import { env } from "@/lib/env";
import { buildOpenApiSpec } from "@/lib/openapi";

export function getTraceLabOpenApiSpec() {
  return buildOpenApiSpec({
    title: "TraceLab Webhooks API",
    version: "2.0.0",
    description:
      "Live SSE Webhook Inspector, Stripe/GitHub HMAC-SHA256 verifier, cURL/TS/Python snippet generator, Replay diff engine (anti-SSRF), and integrated MCP server.",
    serverUrl: env.NEXT_PUBLIC_APP_URL,
    routes: [
      {
        path: "/api/health",
        method: "get",
        summary: "Health check with SQLite latency",
        tag: "Observability",
      },
      {
        path: "/api/bins",
        method: "get",
        summary: "List ephemeral bins and captured request counts",
        tag: "Bins",
      },
      {
        path: "/api/bins",
        method: "post",
        summary: "Create a new ephemeral bin (configurable TTL)",
        tag: "Bins",
        requestSchema: CreateBinSchema,
      },
      {
        path: "/api/bins/{binId}",
        method: "get",
        summary: "Get bin details, captured requests, and replay logs",
        tag: "Bins",
      },
      {
        path: "/api/bins/{binId}",
        method: "patch",
        summary: "Update custom bin response status and body",
        tag: "Bins",
        requestSchema: UpdateBinSchema,
      },
      {
        path: "/api/bins/{binId}",
        method: "delete",
        summary: "Delete bin and cascade captured requests",
        tag: "Bins",
      },
      {
        path: "/api/bins/{binId}/stream",
        method: "get",
        summary:
          "Real-time SSE stream (event: request:captured, 15s keep-alive)",
        tag: "Streaming",
      },
      {
        path: "/api/hook/{binId}",
        method: "post",
        summary:
          "Capture incoming webhook (GET/POST/PUT/PATCH/DELETE, max 512 KB)",
        tag: "Capture",
      },
      {
        path: "/api/requests/{id}/replay",
        method: "post",
        summary: "Replay captured request to SSRF-validated external URL",
        tag: "Replay",
        requestSchema: ReplayRequestSchema,
      },
      {
        path: "/api/hmac/verify",
        method: "post",
        summary:
          "Timing-safe HMAC-SHA256 verification (GitHub, Stripe, raw hex)",
        tag: "Security",
        requestSchema: VerifyHmacSchema,
      },
      {
        path: "/api/mcp",
        method: "post",
        summary: "Model Context Protocol (MCP) JSON-RPC 2.0 endpoint",
        tag: "MCP",
      },
    ],
  });
}
