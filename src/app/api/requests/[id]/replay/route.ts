import { ReplayRequestSchema } from "@/contracts/schemas";
import { replayCapturedRequest } from "@/core/capture";
import {
  getRequestId,
  jsonWithRequestId,
  problemResponse,
} from "@/lib/problem-details";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const REPLAY_ERROR_TITLES: Record<400 | 404 | 502, string> = {
  400: "Replay Blocked",
  404: "Request Not Found",
  502: "Bad Gateway",
};

export async function POST(req: Request, context: RouteContext) {
  const requestId = getRequestId(req);
  const { id } = await context.params;
  const raw = await req.json().catch(() => null);
  const parsed = ReplayRequestSchema.safeParse(raw);

  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Invalid Replay Request",
      detail: "Solicitud de replay inválida",
      instance: `/api/requests/${id}/replay`,
      requestId,
      errors: parsed.error.flatten(),
    });
  }

  const outcome = await replayCapturedRequest({
    requestId: id,
    targetUrl: parsed.data.targetUrl,
    ...(parsed.data.method ? { method: parsed.data.method } : {}),
    ...(parsed.data.headers ? { headers: parsed.data.headers } : {}),
    ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
  });

  if (!outcome.ok) {
    return problemResponse({
      status: outcome.status,
      title: REPLAY_ERROR_TITLES[outcome.status],
      detail: outcome.error,
      instance: `/api/requests/${id}/replay`,
      requestId,
    });
  }

  return jsonWithRequestId({ replay: outcome.replay }, { requestId });
}
