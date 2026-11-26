import { randomBytes } from "node:crypto";
import { CreateBinSchema } from "@/contracts/schemas";
import { getDb } from "@/db";
import { bins, capturedRequests } from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import {
  getRequestId,
  jsonWithRequestId,
  problemResponse,
} from "@/lib/problem-details";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function generateShortBinId(): string {
  return randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "x")
    .slice(0, 10);
}

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const db = getDb();
  let rows = await db.select().from(bins).orderBy(desc(bins.createdAt));

  if (rows.length === 0) {
    await seedDatabase();
    rows = await db.select().from(bins).orderBy(desc(bins.createdAt));
  }

  const counts = await db
    .select({
      binId: capturedRequests.binId,
      count: sql<number>`count(*)`,
    })
    .from(capturedRequests)
    .groupBy(capturedRequests.binId);

  const countMap = new Map(
    counts.map((item) => [item.binId, Number(item.count)]),
  );
  const result = rows.map((bin) => ({
    ...bin,
    requestCount: countMap.get(bin.id) ?? 0,
  }));

  return jsonWithRequestId({ bins: result }, { requestId });
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }

  const parsed = CreateBinSchema.safeParse(raw);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Invalid Bin Payload",
      detail: "Datos inválidos para crear bin",
      instance: "/api/bins",
      requestId,
      errors: parsed.error.flatten(),
    });
  }

  const nowMs = Date.now();
  const newBin = {
    id: generateShortBinId(),
    name: parsed.data.name,
    customResponseStatus: parsed.data.customResponseStatus,
    customResponseBody: parsed.data.customResponseBody,
    expiresAt: new Date(nowMs + parsed.data.ttlHours * 3_600_000).toISOString(),
    createdAt: new Date(nowMs).toISOString(),
  };

  const db = getDb();
  await db.insert(bins).values(newBin);

  return jsonWithRequestId(
    { bin: { ...newBin, requestCount: 0 } },
    { status: 201, requestId },
  );
}
