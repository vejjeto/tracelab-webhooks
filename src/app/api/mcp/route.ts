import {
  getRequestId,
  jsonWithRequestId,
  problemResponse,
} from "@/lib/problem-details";
import { handleMcpJsonRpc } from "@/mcp/tools";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const body = await req.json().catch(() => null);

  if (body === null) {
    return problemResponse({
      status: 400,
      title: "Invalid JSON",
      detail: "Request body must be valid JSON-RPC 2.0",
      instance: "/api/mcp",
      requestId,
    });
  }

  const response = await handleMcpJsonRpc(body);
  if (!response) {
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": requestId },
    });
  }

  return jsonWithRequestId(response, { requestId });
}
