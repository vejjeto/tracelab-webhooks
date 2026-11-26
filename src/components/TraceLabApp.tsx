"use client";

import { UiButton } from "@/components/ui/button";
import { HealthBadge } from "@/components/ui/health-badge";
import { useUiToast } from "@/components/ui/toast-provider";
import type {
  BinDTO,
  CapturedRequestDTO,
  ReplayLogDTO,
} from "@/contracts/schemas";
import { type InspectorTab, useTraceLabStore } from "@/store/tracelab-store";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bot,
  Check,
  Code2,
  Copy,
  FileCode2,
  GitCompareArrows,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import * as React from "react";
import { HmacVerifierPanel } from "./HmacVerifierPanel";
import { McpInspectorPanel } from "./McpInspectorPanel";
import { ReplayDiffPanel } from "./ReplayDiffPanel";
import { SnippetsPanel } from "./SnippetsPanel";
import { ThemeToggle } from "./ThemeToggle";

interface BinDetailResponse {
  bin: BinDTO;
  isExpired: boolean;
  requests: CapturedRequestDTO[];
  replayLogs: ReplayLogDTO[];
}

const METHOD_BADGE: Record<string, string> = {
  GET: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  POST: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PATCH: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  DELETE: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

async function signBrowserHmacHex(
  payload: string,
  secret: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await window.crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeJsonRecord(jsonStr: string): Record<string, string> {
  try {
    return JSON.parse(jsonStr) as Record<string, string>;
  } catch {
    return {};
  }
}

function formatBodyPreview(rawBody: string, pretty: boolean): string {
  if (!rawBody) return "(cuerpo vacío)";
  if (!pretty) return rawBody;
  try {
    return JSON.stringify(JSON.parse(rawBody), null, 2);
  } catch {
    return rawBody;
  }
}

export function TraceLabApp() {
  const queryClient = useQueryClient();
  const { pushToast } = useUiToast();
  const {
    activeBinId,
    selectedRequestId,
    activeTab,
    prettyBody,
    setActiveBinId,
    setSelectedRequestId,
    setActiveTab,
    togglePrettyBody,
  } = useTraceLabStore();

  const [origin, setOrigin] = React.useState("http://localhost:3008");
  const [sseState, setSseState] = React.useState<
    "connected" | "connecting" | "error"
  >("connecting");
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [simulating, setSimulating] = React.useState<string | null>(null);

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const binsQuery = useQuery<{ bins: BinDTO[] }>({
    queryKey: ["bins"],
    queryFn: async () => {
      const res = await fetch("/api/bins");
      if (!res.ok) throw new Error("No se pudieron cargar los bins");
      return res.json();
    },
  });

  const binDetailQuery = useQuery<BinDetailResponse>({
    queryKey: ["bin", activeBinId],
    queryFn: async () => {
      const res = await fetch(`/api/bins/${activeBinId}`);
      if (!res.ok) throw new Error("Bin no encontrado");
      return res.json();
    },
    enabled: Boolean(activeBinId),
  });

  React.useEffect(() => {
    const list = binsQuery.data?.bins ?? [];
    const firstBin = list[0];
    if (firstBin && !list.some((b) => b.id === activeBinId)) {
      setActiveBinId(firstBin.id);
    }
  }, [binsQuery.data, activeBinId, setActiveBinId]);

  React.useEffect(() => {
    const requests = binDetailQuery.data?.requests ?? [];
    const firstReq = requests[0];
    if (
      firstReq &&
      (!selectedRequestId || !requests.some((r) => r.id === selectedRequestId))
    ) {
      setSelectedRequestId(firstReq.id);
    }
  }, [binDetailQuery.data, selectedRequestId, setSelectedRequestId]);

  React.useEffect(() => {
    if (!activeBinId) return;
    setSseState("connecting");
    const source = new EventSource(`/api/bins/${activeBinId}/stream`);

    source.addEventListener("connected", () => {
      setSseState("connected");
    });

    source.addEventListener("request:captured", (event) => {
      try {
        const captured = JSON.parse(
          (event as MessageEvent<string>).data,
        ) as CapturedRequestDTO;
        queryClient.setQueryData<BinDetailResponse>(
          ["bin", activeBinId],
          (prev) => {
            if (!prev) return prev;
            if (prev.requests.some((r) => r.id === captured.id)) return prev;
            return { ...prev, requests: [captured, ...prev.requests] };
          },
        );
        setSelectedRequestId(captured.id);
      } catch {
        // Ignore malformed event
      }
    });

    source.onerror = () => {
      setSseState("error");
    };

    return () => {
      source.close();
    };
  }, [activeBinId, queryClient, setSelectedRequestId]);

  const createNewBin = async () => {
    try {
      const res = await fetch("/api/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Bin ${new Date().toLocaleTimeString("es-ES")}`,
        }),
      });
      const data = (await res.json()) as { bin?: BinDTO };
      if (!res.ok || !data.bin) throw new Error("Error creando bin");
      await queryClient.invalidateQueries({ queryKey: ["bins"] });
      setActiveBinId(data.bin.id);
      pushToast({ title: `Bin ${data.bin.id} creado`, variant: "success" });
    } catch {
      pushToast({ title: "No se pudo crear el bin", variant: "error" });
    }
  };

  const simulateWebhook = async (kind: "stripe" | "github" | "custom") => {
    setSimulating(kind);
    const demoSecret = "tracelab-demo-webhook-secret";
    try {
      let headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      let payload = "";

      if (kind === "stripe") {
        payload = JSON.stringify(
          {
            id: `evt_stripe_${Date.now()}`,
            type: "invoice.paid",
            data: {
              object: {
                amount_paid: 7900,
                currency: "usd",
                customer: "cus_tracelab",
              },
            },
          },
          null,
          2,
        );
        const ts = Math.floor(Date.now() / 1000);
        const v1 = await signBrowserHmacHex(`${ts}.${payload}`, demoSecret);
        headers = { ...headers, "Stripe-Signature": `t=${ts},v1=${v1}` };
      } else if (kind === "github") {
        payload = JSON.stringify(
          {
            ref: "refs/heads/main",
            repository: { full_name: "tracelab/webhooks-demo" },
            commits: [{ message: "chore: live SSE webhook test" }],
          },
          null,
          2,
        );
        const hex = await signBrowserHmacHex(payload, demoSecret);
        headers = {
          ...headers,
          "X-GitHub-Event": "push",
          "X-Hub-Signature-256": `sha256=${hex}`,
        };
      } else {
        payload = JSON.stringify(
          {
            id: crypto.randomUUID(),
            event: "order.delivery_failed",
            status: "error",
            timestamp: new Date().toISOString(),
            data: { orderId: "ord_api_prod", statusCode: 502, latencyMs: 1450 },
          },
          null,
          2,
        );
        const hex = await signBrowserHmacHex(payload, demoSecret);
        headers = {
          ...headers,
          "X-Webhook-Event": "order.delivery_failed",
          "X-Webhook-Signature": hex,
        };
      }

      const res = await fetch(`/api/hook/${activeBinId}`, {
        method: "POST",
        headers,
        body: payload,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast({
        title: `Webhook ${kind} capturado vía SSE`,
        variant: "success",
      });
    } catch {
      pushToast({ title: "Error simulando webhook", variant: "error" });
    } finally {
      setSimulating(null);
    }
  };

  const captureUrl = `${origin}/api/hook/${activeBinId}`;
  const requests = binDetailQuery.data?.requests ?? [];
  const replayLogs = binDetailQuery.data?.replayLogs ?? [];
  const selectedRequest =
    requests.find((r) => r.id === selectedRequestId) ?? requests[0] ?? null;

  const copyCaptureUrl = async () => {
    try {
      await navigator.clipboard.writeText(captureUrl);
      setCopiedUrl(true);
      pushToast({ title: "URL de captura copiada", variant: "success" });
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      pushToast({ title: "No se pudo copiar", variant: "error" });
    }
  };

  const tabs: { id: InspectorTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "body",
      label: "Body & Headers",
      icon: <Code2 className="h-3.5 w-3.5" />,
    },
    {
      id: "hmac",
      label: "HMAC Verifier",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
    {
      id: "snippets",
      label: "Snippets",
      icon: <Send className="h-3.5 w-3.5" />,
    },
    {
      id: "replay",
      label: `Replay & Diff (${selectedRequest ? replayLogs.filter((l) => l.requestId === selectedRequest.id).length : 0})`,
      icon: <GitCompareArrows className="h-3.5 w-3.5" />,
    },
    {
      id: "mcp",
      label: "MCP Inspector",
      icon: <Bot className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-4 sm:px-6">
      {/* Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Webhook className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">TraceLab</h1>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-400">
                SSE Live
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live Webhook Inspector, HMAC Verifier & API Replay
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activeBinId}
            onChange={(e) => setActiveBinId(e.target.value)}
            aria-label="Seleccionar Bin"
            className="h-8 rounded-lg border border-zinc-300 bg-white px-2.5 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {(binsQuery.data?.bins ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} ({b.requestCount ?? 0})
              </option>
            ))}
          </select>

          <UiButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={createNewBin}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo Bin
          </UiButton>

          <HealthBadge endpoint="/api/health" />

          <a
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-500/60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
          >
            <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
            API Docs
          </a>

          <ThemeToggle />
        </div>
      </header>

      {/* Capture URL + SSE Status + Quick Simulators */}
      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 font-mono text-[11px] font-bold text-emerald-400">
              ANY
            </span>
            <code className="flex-1 truncate rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 font-mono text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {captureUrl}
            </code>
            <button
              type="button"
              onClick={copyCaptureUrl}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:border-indigo-500/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {copiedUrl ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              Copiar URL
            </button>

            <span
              data-testid="sse-status"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                sseState === "connected"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : sseState === "connecting"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-400"
              }`}
            >
              <Radio className="h-3 w-3" />
              {sseState === "connected"
                ? "SSE Conectado"
                : sseState === "connecting"
                  ? "Conectando SSE..."
                  : "SSE Reconectando"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <UiButton
              type="button"
              size="sm"
              variant="outline"
              loading={simulating === "stripe"}
              onClick={() => simulateWebhook("stripe")}
            >
              Disparar Webhook Stripe
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              variant="outline"
              loading={simulating === "github"}
              onClick={() => simulateWebhook("github")}
            >
              Disparar Webhook GitHub
            </UiButton>
            <UiButton
              type="button"
              size="sm"
              variant="primary"
              loading={simulating === "custom"}
              onClick={() => simulateWebhook("custom")}
            >
              Disparar JSON Custom
            </UiButton>
          </div>
        </div>
      </section>

      {/* Master-Detail Inspector */}
      <main className="grid flex-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Requests Stream */}
        <aside className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Activity className="h-3.5 w-3.5 text-indigo-400" />
              Requests ({requests.length})
            </span>
          </div>

          <div className="max-h-[680px] flex-1 divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
            {requests.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                Esperando webhooks entrantes en{" "}
                <code className="font-mono">/api/hook/{activeBinId}</code>...
              </div>
            ) : (
              requests.map((req) => {
                const isSelected = selectedRequest?.id === req.id;
                const badgeCls =
                  METHOD_BADGE[req.method] ??
                  "bg-zinc-500/15 text-zinc-300 border-zinc-700";
                return (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left transition ${
                      isSelected
                        ? "bg-indigo-500/10 dark:bg-indigo-500/15"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${badgeCls}`}
                      >
                        {req.method}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-500">
                        {req.sizeBytes} B ·{" "}
                        {new Date(req.receivedAt).toLocaleTimeString("es-ES")}
                      </span>
                    </div>
                    <p className="truncate font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      {req.path}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                      {req.rawBody.slice(0, 72) || "(sin cuerpo)"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Inspector Details */}
        <section className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60">
          {!selectedRequest ? (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-zinc-500">
              Selecciona o simula un webhook para inspeccionarlo.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-xs font-bold ${
                      METHOD_BADGE[selectedRequest.method] ??
                      "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {selectedRequest.method}
                  </span>
                  <code className="font-mono text-xs text-zinc-700 dark:text-zinc-200">
                    {selectedRequest.path}
                  </code>
                </div>
                <span className="font-mono text-xs text-zinc-500">
                  ID: {selectedRequest.id} · {selectedRequest.sizeBytes} bytes
                </span>
              </div>

              <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      activeTab === tab.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {activeTab === "body" && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Payload Body ({selectedRequest.contentType})
                        </h3>
                        <button
                          type="button"
                          onClick={togglePrettyBody}
                          className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:border-indigo-500 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          {prettyBody ? "Ver Raw" : "Pretty JSON"}
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-zinc-100 p-4 font-mono text-xs text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                        {formatBodyPreview(selectedRequest.rawBody, prettyBody)}
                      </pre>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Headers Sanitizados
                        </h3>
                        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                          <table className="w-full text-left font-mono text-[11px]">
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                              {Object.entries(
                                safeJsonRecord(selectedRequest.headersJson),
                              ).map(([k, v]) => (
                                <tr key={k}>
                                  <td className="w-2/5 bg-zinc-50 px-3 py-1.5 font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                                    {k}
                                  </td>
                                  <td className="break-all px-3 py-1.5 text-zinc-600 dark:text-zinc-400">
                                    {v}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Query Params JSON
                        </h3>
                        <pre className="rounded-xl border border-zinc-200 bg-zinc-100 p-3 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                          {formatBodyPreview(selectedRequest.queryJson, true)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "hmac" && (
                  <HmacVerifierPanel request={selectedRequest} />
                )}

                {activeTab === "snippets" && (
                  <SnippetsPanel request={selectedRequest} origin={origin} />
                )}

                {activeTab === "replay" && (
                  <ReplayDiffPanel
                    request={selectedRequest}
                    replayLogs={replayLogs}
                    onReplaySuccess={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ["bin", activeBinId],
                      });
                    }}
                  />
                )}

                {activeTab === "mcp" && (
                  <McpInspectorPanel
                    activeBinId={activeBinId}
                    selectedRequest={selectedRequest}
                  />
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
