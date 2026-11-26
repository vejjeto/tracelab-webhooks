"use client";

import * as React from "react";

interface HealthResponse {
  status: string;
  db?: { ok: boolean; latencyMs?: number };
}

export function HealthBadge({
  endpoint = "/api/health",
}: { endpoint?: string }) {
  const [state, setState] = React.useState<"loading" | "ok" | "error">(
    "loading",
  );
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const data = (await res.json()) as HealthResponse;
        if (!active) return;
        if (res.ok && data.status === "ok") {
          setState("ok");
          setLatencyMs(data.db?.latencyMs ?? null);
        } else {
          setState("error");
        }
      } catch {
        if (active) setState("error");
      }
    };

    void check();
    const timer = setInterval(() => void check(), 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [endpoint]);

  const badgeClass =
    state === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : state === "error"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
        : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400";

  return (
    <span
      title="API & SQLite Health"
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11px] font-medium ${badgeClass}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          state === "ok"
            ? "bg-emerald-400"
            : state === "error"
              ? "bg-rose-400"
              : "bg-zinc-400"
        }`}
      />
      {state === "ok"
        ? latencyMs !== null
          ? `DB ${latencyMs}ms`
          : "Healthy"
        : state === "error"
          ? "Degraded"
          : "Checking..."}
    </span>
  );
}
