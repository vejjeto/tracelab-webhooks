import type { z } from "zod";

export interface OpenApiRouteDef {
  path: string;
  method: "get" | "post" | "put" | "patch" | "delete";
  summary: string;
  tag: string;
  requestSchema?: z.ZodTypeAny;
}

export interface OpenApiConfig {
  title: string;
  version: string;
  description: string;
  serverUrl: string;
  routes: OpenApiRouteDef[];
}

export function buildOpenApiSpec(config: OpenApiConfig) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of config.routes) {
    const entry = paths[route.path] ?? {};
    entry[route.method] = {
      tags: [route.tag],
      summary: route.summary,
      ...(route.requestSchema
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          }
        : {}),
      responses: {
        "200": { description: "Successful response" },
        "400": { description: "RFC 7807 Problem Details (Bad Request)" },
      },
    };
    paths[route.path] = entry;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: config.title,
      version: config.version,
      description: config.description,
    },
    servers: [{ url: config.serverUrl }],
    paths,
  };
}

export function renderOpenApiDocsHtml(opts: {
  title: string;
  specUrl: string;
}): string {
  return `<!doctype html>
<html lang="en" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title} — OpenAPI Docs</title>
  <style>
    body { margin: 0; background: #09090b; color: #f4f4f5; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <script id="api-reference" data-url="${opts.specUrl}"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}
