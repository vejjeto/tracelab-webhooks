"use client";

import type { CapturedRequestDTO } from "@/contracts/schemas";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import * as React from "react";

const SIGNATURE_CANDIDATES = [
  "stripe-signature",
  "x-hub-signature-256",
  "x-webhook-signature",
  "x-signature-256",
];

function safeParseHeaders(headersJson: string): Record<string, string> {
  try {
    return JSON.parse(headersJson) as Record<string, string>;
  } catch {
    return {};
  }
}

function detectSignatureHeader(headers: Record<string, string>): {
  name: string;
  value: string;
} {
  const entries = Object.entries(headers);
  for (const candidate of SIGNATURE_CANDIDATES) {
    const found = entries.find(([k]) => k.toLowerCase() === candidate);
    if (found?.[1]) {
      return { name: found[0], value: found[1] };
    }
  }
  return { name: "x-hub-signature-256", value: "" };
}

export function HmacVerifierPanel({
  request,
}: { request: CapturedRequestDTO }) {
  const headers = React.useMemo(
    () => safeParseHeaders(request.headersJson),
    [request.headersJson],
  );
  const detected = React.useMemo(
    () => detectSignatureHeader(headers),
    [headers],
  );

  const [secret, setSecret] = React.useState("tracelab-demo-webhook-secret");
  const [signatureInput, setSignatureInput] = React.useState(detected.value);
  const [result, setResult] = React.useState<{
    valid: boolean;
    format: string;
    expectedPrefixed: string;
  } | null>(null);
  const [checking, setChecking] = React.useState(false);

  React.useEffect(() => {
    setSignatureInput(detected.value);
  }, [detected.value]);

  React.useEffect(() => {
    if (!secret || !signatureInput.trim()) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setChecking(true);
    fetch("/api/hmac/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: request.rawBody,
        signatureHeader: signatureInput,
        secret,
      }),
    })
      .then((res) => res.json())
      .then(
        (data: {
          valid: boolean;
          format: string;
          expectedPrefixed: string;
        }) => {
          if (!cancelled) setResult(data);
        },
      )
      .catch(() => {
        if (!cancelled) setResult(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [request.rawBody, signatureInput, secret]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <KeyRound className="h-4 w-4 text-indigo-400" />
          <span>
            Header detectado:{" "}
            <code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[11px] dark:bg-zinc-800">
              {detected.name}
            </code>
          </span>
        </div>

        {!signatureInput.trim() ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            Sin firma HMAC en este request
          </span>
        ) : checking ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
            Verificando...
          </span>
        ) : result?.valid ? (
          <span
            data-testid="hmac-status-badge"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Firma HMAC Válida ({result.format})
          </span>
        ) : (
          <span
            data-testid="hmac-status-badge"
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-400"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Firma Inválida
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-xs">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Webhook Secret
          </span>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Ingresa el secret compartido..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>

        <label className="space-y-1.5 text-xs">
          <span className="font-medium text-zinc-600 dark:text-zinc-300">
            Firma Recibida (sha256=&lt;hex&gt; o hex)
          </span>
          <input
            type="text"
            value={signatureInput}
            onChange={(e) => setSignatureInput(e.target.value)}
            placeholder="sha256=..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
          />
        </label>
      </div>

      {result?.expectedPrefixed && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            Digest esperado (timing-safe SHA-256)
          </span>
          <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-2.5 font-mono text-[11px] text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {result.expectedPrefixed}
          </pre>
        </div>
      )}
    </div>
  );
}
