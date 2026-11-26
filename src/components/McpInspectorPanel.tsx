"use client";

import type { CapturedRequestDTO } from "@/contracts/schemas";
import { Bot, Play } from "lucide-react";
import * as React from "react";
import { UiButton } from "./ui/button";

type McpToolName =
  | "list_recent_webhooks"
  | "get_webhook_detail"
  | "get_last_error_webhook"
  | "verify_webhook_hmac";

const TOOL_DESCRIPTIONS: Record<McpToolName, string> = {
  list_recent_webhooks:
    "Lista los webhooks capturados recientemente para un bin.",
  get_webhook_detail: "Obtiene headers, body y logs de replay de un requestId.",
  get_last_error_webhook:
    "Busca el último webhook con payload de error o replay >= 400.",
  verify_webhook_hmac:
    "Verifica firma HMAC-SHA256 (Stripe, GitHub o raw hex) en tiempo constante.",
};

function buildDefaultArgs(
  tool: McpToolName,
  binId: string,
  request: CapturedRequestDTO | null,
): string {
  switch (tool) {
    case "list_recent_webhooks":
      return JSON.stringify({ binId, limit: 5 }, null, 2);
    case "get_webhook_detail":
      return JSON.stringify(
        { requestId: request?.id ?? "req_seed_stripe_01" },
        null,
        2,
      );
    case "get_last_error_webhook":
      return JSON.stringify({ binId }, null, 2);
    case "verify_webhook_hmac":
      return JSON.stringify(
        {
          payload: request?.rawBody ?? '{"ok":true}',
          signatureHeader: "sha256=demo",
          secret: "tracelab-demo-webhook-secret",
        },
        null,
        2,
      );
  }
}

export function McpInspectorPanel({
  activeBinId,
  selectedRequest,
}: {
  activeBinId: string;
  selectedRequest: CapturedRequestDTO | null;
}) {
  const [tool, setTool] = React.useState<McpToolName>("list_recent_webhooks");
  const [argsJson, setArgsJson] = React.useState(() =>
    buildDefaultArgs("list_recent_webhooks", activeBinId, selectedRequest),
  );
  const [responseText, setResponseText] = React.useState<string>("");
  const [running, setRunning] = React.useState(false);

  React.useEffect(() => {
    setArgsJson(buildDefaultArgs(tool, activeBinId, selectedRequest));
  }, [tool, activeBinId, selectedRequest]);

  const executeTool = async () => {
    setRunning(true);
    try {
      const parsedArgs = JSON.parse(argsJson) as Record<string, unknown>;
      const rpcPayload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: tool,
          arguments: parsedArgs,
        },
      };
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcPayload),
      });
      const data = (await res.json()) as unknown;
      setResponseText(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponseText(
        JSON.stringify(
          {
            error:
              err instanceof Error ? err.message : "Invalid JSON arguments",
          },
          null,
          2,
        ),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-200">
          <Bot className="h-4 w-4 text-indigo-400" />
          <span>
            JSON-RPC 2.0 Endpoint:{" "}
            <code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
              POST /api/mcp
            </code>
          </span>
        </div>

        <UiButton
          type="button"
          size="sm"
          loading={running}
          onClick={executeTool}
          data-testid="mcp-run-button"
        >
          <Play className="h-3.5 w-3.5" />
          Ejecutar MCP Tool
        </UiButton>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-xs">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            MCP Tool
          </span>
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value as McpToolName)}
            aria-label="Seleccionar MCP Tool"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {(Object.keys(TOOL_DESCRIPTIONS) as McpToolName[]).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500">{TOOL_DESCRIPTIONS[tool]}</p>
        </label>

        <label className="space-y-1.5 text-xs">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Arguments (JSON)
          </span>
          <textarea
            rows={4}
            value={argsJson}
            onChange={(e) => setArgsJson(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 font-mono text-[11px] outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>
      </div>

      {responseText && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Respuesta JSON-RPC 2.0
          </span>
          <pre
            data-testid="mcp-response-output"
            className="max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-zinc-100 p-3 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            {responseText}
          </pre>
        </div>
      )}
    </div>
  );
}
