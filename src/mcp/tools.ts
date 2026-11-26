import { verifyWebhookSignature } from "@/core/hmac";
import { getDb } from "@/db";
import { capturedRequests, replayLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "list_recent_webhooks",
    description: "List recent captured webhooks, optionally filtered by binId.",
    inputSchema: {
      type: "object",
      properties: {
        binId: {
          type: "string",
          description: "Optional bin ID filter (e.g., demo-bin)",
        },
        limit: {
          type: "number",
          description: "Max items to return (1-50, default 10)",
        },
      },
    },
  },
  {
    name: "get_webhook_detail",
    description:
      "Get full headers, body, and replay logs for a captured webhook by requestId.",
    inputSchema: {
      type: "object",
      properties: {
        requestId: {
          type: "string",
          description: "Captured request ID (e.g., req_seed_stripe_01)",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "get_last_error_webhook",
    description:
      "Find the most recent captured webhook with an error payload or failed replay (>= 400).",
    inputSchema: {
      type: "object",
      properties: {
        binId: { type: "string", description: "Optional bin ID filter" },
      },
    },
  },
  {
    name: "verify_webhook_hmac",
    description:
      "Verify a webhook HMAC-SHA256 signature in constant time (supports GitHub sha256=, Stripe t=,v1=, or raw hex).",
    inputSchema: {
      type: "object",
      properties: {
        payload: { type: "string", description: "Raw webhook request body" },
        signatureHeader: {
          type: "string",
          description: "Signature header value",
        },
        secret: { type: "string", description: "Shared webhook secret" },
      },
      required: ["payload", "signatureHeader", "secret"],
    },
  },
];

const ListRecentSchema = z.object({
  binId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

const GetDetailSchema = z.object({
  requestId: z.string().trim().min(1),
});

const LastErrorSchema = z.object({
  binId: z.string().trim().min(1).optional(),
});

const VerifyHmacArgsSchema = z.object({
  payload: z.string(),
  signatureHeader: z.string().min(1),
  secret: z.string().min(1),
});

function isErrorPayload(rawBody: string): boolean {
  const lower = rawBody.toLowerCase();
  if (lower.includes('"status":"error"') || lower.includes('"status": "error"'))
    return true;
  if (lower.includes('"statuscode":5') || lower.includes('"statuscode": 5'))
    return true;
  if (lower.includes('"statuscode":4') || lower.includes('"statuscode": 4'))
    return true;
  if (lower.includes("failed") || lower.includes("incident_opened"))
    return true;
  return false;
}

export async function executeMcpTool(
  name: string,
  rawArgs: Record<string, unknown> = {},
): Promise<unknown> {
  const db = getDb();

  switch (name) {
    case "list_recent_webhooks": {
      const args = ListRecentSchema.parse(rawArgs);
      const rows = args.binId
        ? await db
            .select()
            .from(capturedRequests)
            .where(eq(capturedRequests.binId, args.binId))
            .orderBy(desc(capturedRequests.receivedAt))
            .limit(args.limit)
        : await db
            .select()
            .from(capturedRequests)
            .orderBy(desc(capturedRequests.receivedAt))
            .limit(args.limit);

      return {
        count: rows.length,
        webhooks: rows.map((r) => ({
          id: r.id,
          binId: r.binId,
          method: r.method,
          path: r.path,
          contentType: r.contentType,
          sizeBytes: r.sizeBytes,
          receivedAt: r.receivedAt,
        })),
      };
    }

    case "get_webhook_detail": {
      const args = GetDetailSchema.parse(rawArgs);
      const [request] = await db
        .select()
        .from(capturedRequests)
        .where(eq(capturedRequests.id, args.requestId))
        .limit(1);

      if (!request) {
        return { found: false, error: `Webhook '${args.requestId}' not found` };
      }

      const replays = await db
        .select()
        .from(replayLogs)
        .where(eq(replayLogs.requestId, request.id))
        .orderBy(desc(replayLogs.replayedAt));

      return { found: true, request, replayLogs: replays };
    }

    case "get_last_error_webhook": {
      const args = LastErrorSchema.parse(rawArgs);
      const candidates = args.binId
        ? await db
            .select()
            .from(capturedRequests)
            .where(eq(capturedRequests.binId, args.binId))
            .orderBy(desc(capturedRequests.receivedAt))
            .limit(50)
        : await db
            .select()
            .from(capturedRequests)
            .orderBy(desc(capturedRequests.receivedAt))
            .limit(50);

      for (const req of candidates) {
        const replays = await db
          .select()
          .from(replayLogs)
          .where(eq(replayLogs.requestId, req.id))
          .orderBy(desc(replayLogs.replayedAt));
        const failedReplay = replays.find((r) => r.responseStatus >= 400);
        if (failedReplay || isErrorPayload(req.rawBody)) {
          return {
            found: true,
            reason: failedReplay
              ? `Replay returned HTTP ${failedReplay.responseStatus}`
              : "Error indicator detected in webhook payload",
            request: req,
            failedReplay: failedReplay ?? null,
          };
        }
      }

      return {
        found: false,
        message: "No error webhooks found in recent history.",
      };
    }

    case "verify_webhook_hmac": {
      const args = VerifyHmacArgsSchema.parse(rawArgs);
      return verifyWebhookSignature(
        args.payload,
        args.signatureHeader,
        args.secret,
      );
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

export async function handleMcpJsonRpc(
  raw: unknown,
): Promise<JsonRpcResponse | null> {
  const parsed = JsonRpcRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "Invalid JSON-RPC 2.0 request",
        data: parsed.error.flatten(),
      },
    };
  }

  const { id, method, params } = parsed.data;
  const responseId = id ?? null;

  if (method === "notifications/initialized" && id === undefined) {
    return null;
  }

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: responseId,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "tracelab-webhooks-mcp", version: "2.0.0" },
      },
    };
  }

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: responseId,
      result: { tools: MCP_TOOLS },
    };
  }

  if (method === "tools/call") {
    const toolName = typeof params?.name === "string" ? params.name : "";
    const toolArgs =
      params?.arguments &&
      typeof params.arguments === "object" &&
      !Array.isArray(params.arguments)
        ? (params.arguments as Record<string, unknown>)
        : {};

    if (!toolName) {
      return {
        jsonrpc: "2.0",
        id: responseId,
        error: { code: -32602, message: "Missing params.name for tools/call" },
      };
    }

    try {
      const output = await executeMcpTool(toolName, toolArgs);
      return {
        jsonrpc: "2.0",
        id: responseId,
        result: {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output,
        },
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tool execution failed";
      return {
        jsonrpc: "2.0",
        id: responseId,
        error: { code: -32602, message },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id: responseId,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}
