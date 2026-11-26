import { randomUUID } from "node:crypto";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  requestId: string;
  errors?: unknown;
}

export function getRequestId(req?: Request): string {
  const incoming = req?.headers.get("x-request-id")?.trim();
  return incoming && incoming.length > 0 ? incoming : randomUUID();
}

export function problemResponse(opts: {
  status: number;
  title: string;
  detail: string;
  type?: string;
  instance?: string;
  requestId?: string;
  errors?: unknown;
}): Response {
  const requestId = opts.requestId ?? randomUUID();
  const body: ProblemDetails = {
    type: opts.type ?? `https://httpstatuses.com/${opts.status}`,
    title: opts.title,
    status: opts.status,
    detail: opts.detail,
    requestId,
    ...(opts.instance ? { instance: opts.instance } : {}),
    ...(opts.errors !== undefined ? { errors: opts.errors } : {}),
  };

  return new Response(JSON.stringify(body), {
    status: opts.status,
    headers: {
      "Content-Type": "application/problem+json; charset=utf-8",
      "x-request-id": requestId,
    },
  });
}

export function jsonWithRequestId(
  data: unknown,
  opts?: {
    status?: number;
    requestId?: string;
    headers?: Record<string, string>;
  },
): Response {
  const requestId = opts?.requestId ?? randomUUID();
  return Response.json(data, {
    status: opts?.status ?? 200,
    headers: {
      ...opts?.headers,
      "x-request-id": requestId,
    },
  });
}
