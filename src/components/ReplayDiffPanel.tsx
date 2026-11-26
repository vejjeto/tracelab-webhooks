"use client";

import { UiButton } from "@/components/ui/button";
import { useUiToast } from "@/components/ui/toast-provider";
import type { CapturedRequestDTO, ReplayLogDTO } from "@/contracts/schemas";
import { computeLineDiff } from "@/core/diff";
import { Clock, GitCompareArrows, Play } from "lucide-react";
import * as React from "react";

function formatJsonIfValid(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function ReplayDiffPanel({
  request,
  replayLogs,
  onReplaySuccess,
}: {
  request: CapturedRequestDTO;
  replayLogs: ReplayLogDTO[];
  onReplaySuccess: () => void;
}) {
  const { pushToast } = useUiToast();
  const [targetUrl, setTargetUrl] = React.useState("https://httpbin.org/post");
  const [method, setMethod] = React.useState(request.method);
  const [headersText, setHeadersText] = React.useState(() =>
    formatJsonIfValid(request.headersJson),
  );
  const [bodyText, setBodyText] = React.useState(request.rawBody);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setMethod(request.method);
    setHeadersText(formatJsonIfValid(request.headersJson));
    setBodyText(request.rawBody);
  }, [request.method, request.headersJson, request.rawBody]);

  const requestReplays = React.useMemo(
    () => replayLogs.filter((r) => r.requestId === request.id),
    [replayLogs, request.id],
  );

  const handleReplay = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedHeaders: Record<string, string> = {};
    try {
      parsedHeaders = JSON.parse(headersText) as Record<string, string>;
    } catch {
      pushToast({ title: "Headers JSON inválido", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/replay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          method,
          headers: parsedHeaders,
          body: bodyText,
        }),
      });
      const data = (await res.json()) as {
        replay?: ReplayLogDTO;
        error?: string;
      };
      if (!res.ok || !data.replay) {
        pushToast({
          title: "Replay rechazado",
          description: data.error ?? `HTTP ${res.status}`,
          variant: "error",
        });
        return;
      }
      pushToast({
        title: `Replay HTTP ${data.replay.responseStatus}`,
        description: `Completado en ${data.replay.durationMs} ms`,
        variant: "success",
      });
      onReplaySuccess();
    } catch (err) {
      pushToast({
        title: "Error de red en Replay",
        description: err instanceof Error ? err.message : "Fallo inesperado",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const diffPair = React.useMemo(() => {
    const latest = requestReplays[0];
    const previous = requestReplays[1];
    if (latest && previous) {
      return {
        beforeLabel: `Replay anterior (HTTP ${previous.responseStatus})`,
        afterLabel: `Último replay (HTTP ${latest.responseStatus})`,
        beforeText: formatJsonIfValid(previous.responseBody),
        afterText: formatJsonIfValid(latest.responseBody),
      };
    }
    if (latest) {
      return {
        beforeLabel: "Body original capturado",
        afterLabel: `Respuesta Replay (HTTP ${latest.responseStatus})`,
        beforeText: formatJsonIfValid(request.rawBody),
        afterText: formatJsonIfValid(latest.responseBody),
      };
    }
    return {
      beforeLabel: "Body original capturado",
      afterLabel: "Body editado en Replay",
      beforeText: formatJsonIfValid(request.rawBody),
      afterText: formatJsonIfValid(bodyText),
    };
  }, [requestReplays, request.rawBody, bodyText]);

  const diffLines = React.useMemo(
    () => computeLineDiff(diffPair.beforeText, diffPair.afterText),
    [diffPair.beforeText, diffPair.afterText],
  );

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleReplay}
        className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            aria-label="Método HTTP para Replay"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs font-semibold outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="url"
            required
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://httpbin.org/post"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-950"
          />

          <UiButton
            type="submit"
            loading={submitting}
            size="sm"
            className="shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            Enviar Replay
          </UiButton>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              Headers (JSON)
            </span>
            <textarea
              rows={5}
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 font-mono text-[11px] outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-zinc-600 dark:text-zinc-300">
              Payload Body
            </span>
            <textarea
              rows={5}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 font-mono text-[11px] outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </label>
        </div>
      </form>

      {requestReplays.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Historial de Replays ({requestReplays.length})
          </h4>
          <div className="space-y-1.5">
            {requestReplays.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      log.responseStatus < 400
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    HTTP {log.responseStatus}
                  </span>
                  <span className="truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {log.targetUrl}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                  <Clock className="h-3 w-3" />
                  {log.durationMs} ms
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            <GitCompareArrows className="h-4 w-4 text-indigo-400" />
            Visual Diff ({diffPair.beforeLabel} → {diffPair.afterLabel})
          </span>
        </div>

        <div className="max-h-72 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-[11px] dark:border-zinc-800 dark:bg-zinc-950">
          {diffLines.length === 0 ? (
            <p className="p-4 text-center text-zinc-500">
              Sin contenido para comparar.
            </p>
          ) : (
            diffLines.map((item) => (
              <div
                key={`${item.type}-${item.beforeLineNumber ?? "n"}-${item.afterLineNumber ?? "n"}-${item.line}`}
                className={`flex gap-3 px-3 py-0.5 ${
                  item.type === "added"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : item.type === "removed"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                <span className="w-7 shrink-0 select-none text-right text-zinc-400">
                  {item.beforeLineNumber ?? ""}
                </span>
                <span className="w-7 shrink-0 select-none text-right text-zinc-400">
                  {item.afterLineNumber ?? ""}
                </span>
                <span className="w-3 shrink-0 select-none font-bold">
                  {item.type === "added"
                    ? "+"
                    : item.type === "removed"
                      ? "-"
                      : " "}
                </span>
                <span className="whitespace-pre-wrap break-all">
                  {item.line}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
