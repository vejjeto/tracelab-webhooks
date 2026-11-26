import { getSqlite } from "@/db";
import {
  getRequestId,
  jsonWithRequestId,
  problemResponse,
} from "@/lib/problem-details";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const startedAt = performance.now();

  try {
    const stmt = getSqlite().prepare("SELECT 1 AS ok");
    stmt.get();
    const latencyMs = Math.max(
      0,
      Math.round((performance.now() - startedAt) * 100) / 100,
    );

    return jsonWithRequestId(
      {
        status: "ok",
        service: "tracelab-webhooks",
        version: "2.0.0",
        db: { ok: true, latencyMs },
        timestamp: new Date().toISOString(),
      },
      { requestId },
    );
  } catch (err) {
    return problemResponse({
      status: 503,
      title: "Service Unavailable",
      detail:
        err instanceof Error ? err.message : "Database health check failed",
      instance: "/api/health",
      requestId,
    });
  }
}
