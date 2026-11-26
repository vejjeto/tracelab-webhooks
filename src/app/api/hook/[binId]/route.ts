import { MAX_BODY_BYTES, captureWebhookRequest } from "@/core/capture";
import { getRequestId, problemResponse } from "@/lib/problem-details";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ binId: string }> };

const STATUS_TITLES: Record<404 | 410 | 413, string> = {
  404: "Bin Not Found",
  410: "Bin Expired",
  413: "Payload Too Large",
};

async function handleHookCapture(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  const requestId = getRequestId(req);
  const { binId } = await context.params;
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return problemResponse({
      status: 413,
      title: "Payload Too Large",
      detail: `Payload excede el límite de 512 KB (${declaredLength} bytes)`,
      instance: `/api/hook/${binId}`,
      requestId,
    });
  }

  const buffer = new Uint8Array(await req.arrayBuffer());
  const outcome = await captureWebhookRequest({
    binId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    bodyBytes: buffer,
  });

  if (!outcome.ok) {
    return problemResponse({
      status: outcome.status,
      title: STATUS_TITLES[outcome.status],
      detail: outcome.error,
      instance: `/api/hook/${binId}`,
      requestId,
    });
  }

  return new Response(outcome.body, {
    status: outcome.status,
    headers: {
      "Content-Type": outcome.contentType,
      "X-TraceLab-Request-Id": outcome.captured.id,
      "x-request-id": requestId,
    },
  });
}

export async function GET(req: Request, context: RouteContext) {
  return handleHookCapture(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  return handleHookCapture(req, context);
}

export async function PUT(req: Request, context: RouteContext) {
  return handleHookCapture(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return handleHookCapture(req, context);
}

export async function DELETE(req: Request, context: RouteContext) {
  return handleHookCapture(req, context);
}
