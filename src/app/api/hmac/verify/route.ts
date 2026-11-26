import { VerifyHmacSchema } from "@/contracts/schemas";
import { verifyWebhookSignature } from "@/core/hmac";
import {
  getRequestId,
  jsonWithRequestId,
  problemResponse,
} from "@/lib/problem-details";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const raw = await req.json().catch(() => null);
  const parsed = VerifyHmacSchema.safeParse(raw);

  if (!parsed.success) {
    return problemResponse({
      status: 400,
      title: "Invalid HMAC Verification Payload",
      detail: "Payload inválido para verificación HMAC",
      instance: "/api/hmac/verify",
      requestId,
      errors: parsed.error.flatten(),
    });
  }

  const result = verifyWebhookSignature(
    parsed.data.payload,
    parsed.data.signatureHeader,
    parsed.data.secret,
  );
  return jsonWithRequestId(result, { requestId });
}
