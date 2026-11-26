import { UpdateBinSchema } from "@/contracts/schemas";
import { getDb } from "@/db";
import { bins, capturedRequests, replayLogs } from "@/db/schema";
import {
  getRequestId,
  jsonWithRequestId,
  problemResponse,
} from "@/lib/problem-details";
import { desc, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ binId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const requestId = getRequestId(req);
  const { binId } = await context.params;
  const db = getDb();
  const [bin] = await db.select().from(bins).where(eq(bins.id, binId)).limit(1);

  if (!bin) {
    return problemResponse({
      status: 404,
      title: "Bin Not Found",
      detail: `Bin '${binId}' no encontrado`,
      instance: `/api/bins/${binId}`,
      requestId,
    });
  }

  const requests = await db
    .select()
    .from(capturedRequests)
    .where(eq(capturedRequests.binId, binId))
    .orderBy(desc(capturedRequests.receivedAt));

  const requestIds = requests.map((item) => item.id);
  const replays =
    requestIds.length > 0
      ? await db
          .select()
          .from(replayLogs)
          .where(inArray(replayLogs.requestId, requestIds))
          .orderBy(desc(replayLogs.replayedAt))
      : [];

  return jsonWithRequestId(
    {
      bin,
      isExpired: new Date(bin.expiresAt).getTime() <= Date.now(),
      requests,
      replayLogs: replays,
    },
    { requestId },
  );
}

export async function PATCH(req: Request, context: RouteContext) {
  const requestId = getRequestId(req);
  const { binId } = await context.params;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(bins)
    .where(eq(bins.id, binId))
    .limit(1);

  if (!existing) {
    return problemResponse({
      status: 404,
      title: "Bin Not Found",
      detail: `Bin '${binId}' no encontrado`,
      instance: `/api/bins/${binId}`,
      requestId,
    });
  }

  const raw = await req.json().catch(() => null);
  const parsed = UpdateBinSchema.safeParse(raw);
  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Invalid Update Payload",
      detail: "Datos inválidos para actualizar bin",
      instance: `/api/bins/${binId}`,
      requestId,
      errors: parsed.error.flatten(),
    });
  }

  const updated = {
    name: parsed.data.name ?? existing.name,
    customResponseStatus:
      parsed.data.customResponseStatus ?? existing.customResponseStatus,
    customResponseBody:
      parsed.data.customResponseBody ?? existing.customResponseBody,
  };

  await db.update(bins).set(updated).where(eq(bins.id, binId));
  return jsonWithRequestId({ bin: { ...existing, ...updated } }, { requestId });
}

export async function DELETE(req: Request, context: RouteContext) {
  const requestId = getRequestId(req);
  const { binId } = await context.params;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(bins)
    .where(eq(bins.id, binId))
    .limit(1);

  if (!existing) {
    return problemResponse({
      status: 404,
      title: "Bin Not Found",
      detail: `Bin '${binId}' no encontrado`,
      instance: `/api/bins/${binId}`,
      requestId,
    });
  }

  await db.delete(bins).where(eq(bins.id, binId));
  return jsonWithRequestId({ deleted: true, binId }, { requestId });
}
