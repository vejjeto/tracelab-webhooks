"use client";

import { useUiToast } from "@/components/ui/toast-provider";
import type { CapturedRequestDTO } from "@/contracts/schemas";
import { generateAllSnippets } from "@/core/snippets";
import { type SnippetLang, useTraceLabStore } from "@/store/tracelab-store";
import { Check, Copy } from "lucide-react";
import * as React from "react";

const LANG_OPTIONS: { id: SnippetLang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "typescript", label: "TypeScript (fetch)" },
  { id: "python", label: "Python (requests)" },
];

function safeParseHeaders(headersJson: string): Record<string, string> {
  try {
    return JSON.parse(headersJson) as Record<string, string>;
  } catch {
    return {};
  }
}

export function SnippetsPanel({
  request,
  origin,
}: {
  request: CapturedRequestDTO;
  origin: string;
}) {
  const { snippetLang, setSnippetLang } = useTraceLabStore();
  const { pushToast } = useUiToast();
  const [copied, setCopied] = React.useState(false);

  const snippets = React.useMemo(() => {
    const targetUrl = `${origin}${request.path}`;
    return generateAllSnippets({
      method: request.method,
      url: targetUrl,
      headers: safeParseHeaders(request.headersJson),
      body: request.rawBody,
    });
  }, [origin, request]);

  const activeCode = snippets[snippetLang];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      pushToast({ title: "Snippet copiado", variant: "success" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      pushToast({
        title: "No se pudo copiar al portapapeles",
        variant: "error",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {LANG_OPTIONS.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => setSnippetLang(lang.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                snippetLang === lang.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-indigo-500/60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copiado" : "Copiar snippet"}
        </button>
      </div>

      <pre className="max-h-96 overflow-auto rounded-xl border border-zinc-200 bg-zinc-100 p-4 font-mono text-xs leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        {activeCode}
      </pre>
    </div>
  );
}
