import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as postHook } from "@/app/api/hook/[binId]/route";
import { POST as postMcp } from "@/app/api/mcp/route";
import { GET as getOpenApi } from "@/app/api/openapi.json/route";
import { POST as postReplay } from "@/app/api/requests/[id]/replay/route";
import { MAX_BODY_BYTES } from "@/core/capture";
import { computeLineDiff } from "@/core/diff";
import {
  extractSignatureHeader,
  signHmacSha256,
  signStripeSignature,
  verifyWebhookSignature,
} from "@/core/hmac";
import { generateAllSnippets } from "@/core/snippets";
import { subscribeToBin } from "@/core/sse-broker";
import { closeDb, ensureSchema, getDb } from "@/db";
import { bins } from "@/db/schema";
import { validateEnv } from "@/lib/env";
import { isBlockedIpAddress, validateSafeExternalUrl } from "@/lib/ssrf";
import { executeMcpTool } from "@/mcp/tools";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let tempDir = "";

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracelab-test-"));
  process.env.TRACELAB_DB_PATH = path.join(tempDir, "test.db");
  ensureSchema();
});

afterAll(() => {
  closeDb();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("TraceLab Core, Security, MCP & API", () => {
  it("verifies GitHub, Stripe, raw-hex, invalid, and tampered HMAC-SHA256 signatures", () => {
    const payload = JSON.stringify({ event: "invoice.paid", id: "evt_1" });
    const secret = "tracelab-demo-webhook-secret";
    const githubSig = signHmacSha256(payload, secret);
    const rawHex = githubSig.slice("sha256=".length);
    const stripeSig = signStripeSignature(payload, secret, 1732560000);

    expect(verifyWebhookSignature(payload, githubSig, secret)).toMatchObject({
      valid: true,
      format: "github",
    });
    expect(verifyWebhookSignature(payload, stripeSig, secret)).toMatchObject({
      valid: true,
      format: "stripe",
    });
    expect(verifyWebhookSignature(payload, rawHex, secret)).toMatchObject({
      valid: true,
      format: "raw",
    });
    expect(
      verifyWebhookSignature(payload, githubSig, "wrong-secret").valid,
    ).toBe(false);
    expect(verifyWebhookSignature(`${payload} `, githubSig, secret).valid).toBe(
      false,
    );
    expect(verifyWebhookSignature(`${payload} `, stripeSig, secret).valid).toBe(
      false,
    );
    expect(verifyWebhookSignature(payload, undefined, secret).valid).toBe(
      false,
    );
  });

  it("extracts supported signature headers case-insensitively", () => {
    const detected = extractSignatureHeader({
      "Content-Type": "application/json",
      "X-Hub-Signature-256": "sha256=abcdef",
    });
    expect(detected).toEqual({
      headerName: "X-Hub-Signature-256",
      value: "sha256=abcdef",
    });
    expect(
      extractSignatureHeader({ "content-type": "application/json" }),
    ).toBeNull();
  });

  it("generates cURL, TypeScript fetch, and Python requests snippets cleanly", () => {
    const snippets = generateAllSnippets({
      method: "POST",
      url: "http://localhost:3008/api/hook/demo-bin",
      headers: {
        host: "localhost:3008",
        "content-length": "24",
        "content-type": "application/json",
        "x-custom": "it's-ok",
      },
      body: '{"ok":true}',
    });

    expect(snippets.curl).toContain(
      "curl -X POST 'http://localhost:3008/api/hook/demo-bin'",
    );
    expect(snippets.curl).toContain("'x-custom: it'\\''s-ok'");
    expect(snippets.curl).not.toContain("content-length");
    expect(snippets.typescript).toContain(
      'await fetch("http://localhost:3008/api/hook/demo-bin"',
    );
    expect(snippets.typescript).toContain('"method": "POST"');
    expect(snippets.python).toContain("import requests");
    expect(snippets.python).toContain(
      'requests.request("POST", url, headers=headers, data=data, timeout=8)',
    );

    const getSnippets = generateAllSnippets({
      method: "GET",
      url: "http://localhost:3008/api/hook/demo-bin",
      headers: {},
      body: "",
    });
    expect(getSnippets.curl).not.toContain(" -d ");
    expect(getSnippets.python).not.toContain("data=data");
  });

  it("computes accurate line-by-line LCS diff with added, removed, and unchanged lines", () => {
    const before = [
      "{",
      '  "status": "degraded",',
      '  "latency": 900',
      "}",
    ].join("\n");
    const after = [
      "{",
      '  "status": "ok",',
      '  "latency": 900,',
      '  "region": "us-east"',
      "}",
    ].join("\n");
    const diff = computeLineDiff(before, after);

    expect(diff.some((d) => d.type === "unchanged" && d.line === "{")).toBe(
      true,
    );
    expect(
      diff.some((d) => d.type === "removed" && d.line.includes('"degraded"')),
    ).toBe(true);
    expect(
      diff.some((d) => d.type === "added" && d.line.includes('"ok"')),
    ).toBe(true);
    expect(
      diff.some(
        (d) => d.type === "added" && d.line.includes('"region": "us-east"'),
      ),
    ).toBe(true);
  });

  it("validates environment variables and honors SKIP_ENV_VALIDATION=true", () => {
    const skipped = validateEnv({
      SKIP_ENV_VALIDATION: "true",
      NEXT_PUBLIC_APP_URL: "not-a-url",
    });
    expect(skipped.NEXT_PUBLIC_APP_URL).toBe("not-a-url");

    expect(() =>
      validateEnv({
        NEXT_PUBLIC_APP_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects expired bins with RFC 7807 410 Gone and x-request-id", async () => {
    const db = getDb();
    await db.insert(bins).values({
      id: "expired-bin",
      name: "Expired Bin",
      customResponseStatus: 200,
      customResponseBody: '{"ok":true}',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    });

    const req = new Request("http://localhost:3008/api/hook/expired-bin", {
      method: "POST",
      body: '{"test":1}',
    });
    const res = await postHook(req, {
      params: Promise.resolve({ binId: "expired-bin" }),
    });
    expect(res.status).toBe(410);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("enforces 512 KB payload limit with RFC 7807 413 Payload Too Large", async () => {
    const db = getDb();
    await db.insert(bins).values({
      id: "active-cap-bin",
      name: "Active Cap Bin",
      customResponseStatus: 202,
      customResponseBody: '{"accepted":true}',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    const oversized = "x".repeat(MAX_BODY_BYTES + 1);
    const req = new Request("http://localhost:3008/api/hook/active-cap-bin", {
      method: "POST",
      body: oversized,
    });
    const res = await postHook(req, {
      params: Promise.resolve({ binId: "active-cap-bin" }),
    });
    expect(res.status).toBe(413);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
  });

  it("captures webhooks, strips sensitive IP headers, emits SSE, and blocks SSRF replay targets", async () => {
    const capturedEvents: string[] = [];
    const unsubscribe = subscribeToBin("active-cap-bin", (evt) => {
      capturedEvents.push(evt.id);
    });

    const captureReq = new Request(
      "http://localhost:3008/api/hook/active-cap-bin?source=test",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.42",
          "x-real-ip": "203.0.113.42",
          "x-custom-trace": "abc-123",
        },
        body: '{"status":"error","error":"upstream timeout"}',
      },
    );
    const captureRes = await postHook(captureReq, {
      params: Promise.resolve({ binId: "active-cap-bin" }),
    });
    unsubscribe();

    expect(captureRes.status).toBe(202);
    expect(await captureRes.text()).toBe('{"accepted":true}');
    const capturedId = captureRes.headers.get("X-TraceLab-Request-Id");
    expect(capturedId).toBeTruthy();
    expect(capturedEvents).toContain(capturedId);

    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);

    for (const unsafeUrl of [
      "http://127.0.0.1:8080/admin",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost:9000/internal",
    ]) {
      const check = await validateSafeExternalUrl(unsafeUrl);
      expect(check.allowed).toBe(false);

      const replayReq = new Request(
        `http://localhost:3008/api/requests/${capturedId}/replay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUrl: unsafeUrl }),
        },
      );
      const replayRes = await postReplay(replayReq, {
        params: Promise.resolve({ id: capturedId! }),
      });
      expect(replayRes.status).toBe(400);
      expect(replayRes.headers.get("content-type")).toContain(
        "application/problem+json",
      );
      const data = (await replayRes.json()) as { detail: string };
      expect(data.detail.toLowerCase()).toContain("ssrf");
    }
  });

  it("exposes MCP tools (list_recent_webhooks, get_last_error_webhook, verify_webhook_hmac) via JSON-RPC", async () => {
    const recent = (await executeMcpTool("list_recent_webhooks", {
      binId: "active-cap-bin",
      limit: 5,
    })) as { count: number; webhooks: Array<{ id: string }> };
    expect(recent.count).toBeGreaterThanOrEqual(1);

    const lastError = (await executeMcpTool("get_last_error_webhook", {
      binId: "active-cap-bin",
    })) as { found: boolean; request?: { rawBody: string } };
    expect(lastError.found).toBe(true);
    expect(lastError.request?.rawBody).toContain("upstream timeout");

    const hmacSecret = "mcp-secret";
    const hmacPayload = '{"ping":"pong"}';
    const rpcRes = await postMcp(
      new Request("http://localhost:3008/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "verify_webhook_hmac",
            arguments: {
              payload: hmacPayload,
              signatureHeader: signHmacSha256(hmacPayload, hmacSecret),
              secret: hmacSecret,
            },
          },
        }),
      }),
    );

    expect(rpcRes.status).toBe(200);
    expect(rpcRes.headers.get("x-request-id")).toBeTruthy();
    const rpcJson = (await rpcRes.json()) as {
      result: { structuredContent: { valid: boolean; format: string } };
    };
    expect(rpcJson.result.structuredContent).toMatchObject({
      valid: true,
      format: "github",
    });
  });

  it("returns valid health status (tracelab-webhooks) and OpenAPI 3.1.0 specification", async () => {
    const healthRes = await getHealth(
      new Request("http://localhost:3008/api/health"),
    );
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get("x-request-id")).toBeTruthy();
    const healthBody = (await healthRes.json()) as {
      status: string;
      service: string;
    };
    expect(healthBody.status).toBe("ok");
    expect(healthBody.service).toBe("tracelab-webhooks");

    const openApiRes = await getOpenApi(
      new Request("http://localhost:3008/api/openapi.json"),
    );
    expect(openApiRes.status).toBe(200);
    const spec = (await openApiRes.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.paths["/api/hook/{binId}"]).toBeDefined();
    expect(spec.paths["/api/requests/{id}/replay"]).toBeDefined();
    expect(spec.paths["/api/mcp"]).toBeDefined();
  });
});
