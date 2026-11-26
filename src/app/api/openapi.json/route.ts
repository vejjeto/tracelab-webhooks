import { getTraceLabOpenApiSpec } from "@/core/openapi-spec";
import { getRequestId, jsonWithRequestId } from "@/lib/problem-details";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  return jsonWithRequestId(getTraceLabOpenApiSpec(), { requestId });
}
