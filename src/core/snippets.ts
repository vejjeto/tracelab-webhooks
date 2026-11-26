export interface SnippetInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface GeneratedSnippets {
  curl: string;
  typescript: string;
  python: string;
}

const SKIPPED_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "accept-encoding",
]);

function filterHeaders(headers: Record<string, string>): [string, string][] {
  return Object.entries(headers).filter(
    ([key]) => !SKIPPED_HEADERS.has(key.toLowerCase()),
  );
}

function escapeSingleQuotedShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function hasRequestBody(method: string, body: string): boolean {
  const upper = method.toUpperCase();
  return upper !== "GET" && upper !== "HEAD" && body.length > 0;
}

export function generateCurlSnippet(input: SnippetInput): string {
  const method = input.method.toUpperCase();
  const lines = [`curl -X ${method} ${escapeSingleQuotedShell(input.url)}`];

  for (const [key, value] of filterHeaders(input.headers)) {
    lines.push(`  -H ${escapeSingleQuotedShell(`${key}: ${value}`)}`);
  }

  if (hasRequestBody(method, input.body)) {
    lines.push(`  -d ${escapeSingleQuotedShell(input.body)}`);
  }

  return lines.join(" \\\n");
}

export function generateTypeScriptSnippet(input: SnippetInput): string {
  const method = input.method.toUpperCase();
  const headerObj = Object.fromEntries(filterHeaders(input.headers));
  const options: Record<string, unknown> = {
    method,
    headers: headerObj,
  };
  if (hasRequestBody(method, input.body)) {
    options.body = input.body;
  }

  return [
    `const response = await fetch(${JSON.stringify(input.url)}, ${JSON.stringify(options, null, 2)});`,
    "const text = await response.text();",
    "console.log(response.status, text);",
  ].join("\n");
}

export function generatePythonSnippet(input: SnippetInput): string {
  const method = input.method.toUpperCase();
  const headerObj = Object.fromEntries(filterHeaders(input.headers));
  const lines = [
    "import requests",
    "",
    `url = ${JSON.stringify(input.url)}`,
    `headers = ${JSON.stringify(headerObj, null, 2)}`,
  ];

  if (hasRequestBody(method, input.body)) {
    lines.push(`data = ${JSON.stringify(input.body)}`);
    lines.push(
      `response = requests.request(${JSON.stringify(method)}, url, headers=headers, data=data, timeout=8)`,
    );
  } else {
    lines.push(
      `response = requests.request(${JSON.stringify(method)}, url, headers=headers, timeout=8)`,
    );
  }

  lines.push("print(response.status_code, response.text)");
  return lines.join("\n");
}

export function generateAllSnippets(input: SnippetInput): GeneratedSnippets {
  return {
    curl: generateCurlSnippet(input),
    typescript: generateTypeScriptSnippet(input),
    python: generatePythonSnippet(input),
  };
}
