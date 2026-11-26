import { getTraceLabOpenApiSpec } from "@/core/openapi-spec";
import { renderOpenApiDocsHtml } from "@/lib/openapi";
import { getRequestId } from "@/lib/problem-details";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const html = renderOpenApiDocsHtml({
    title: "TraceLab Webhooks API",
    specUrl: "/api/openapi.json",
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}
