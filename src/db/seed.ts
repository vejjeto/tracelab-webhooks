import { randomUUID } from "node:crypto";
import { signHmacSha256, signStripeSignature } from "@/core/hmac";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";
import { closeDb, ensureSchema, getDb } from "./index";
import { bins, capturedRequests } from "./schema";

export const DEMO_BIN_ID = "demo-bin";
export const DEMO_WEBHOOK_SECRET = env.WEBHOOK_SECRET;

function buildSeedRequests(nowMs: number) {
  const stripeBody = JSON.stringify(
    {
      id: "evt_1QTraceLabStripe001",
      object: "event",
      api_version: "2024-06-20",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_9001",
          customer_email: "billing@acme-cloud.dev",
          amount_paid: 4900,
          currency: "usd",
          status: "paid",
        },
      },
    },
    null,
    2,
  );

  const githubBody = JSON.stringify(
    {
      ref: "refs/heads/main",
      before: "a1b2c3d4e5f60000000000000000000000000001",
      after: "9f8e7d6c5b4a0000000000000000000000000002",
      repository: {
        id: 804219,
        full_name: "tracelab/webhooks-demo",
        private: false,
      },
      pusher: { name: "dev-bot", email: "dev@tracelab.local" },
      commits: [
        {
          id: "9f8e7d6c5b4a0000000000000000000000000002",
          message: "feat(webhook): add live SSE replay diff",
          added: ["src/core/diff.ts"],
        },
      ],
    },
    null,
    2,
  );

  const customErrorBody = JSON.stringify(
    {
      id: randomUUID(),
      event: "order.delivery_failed",
      status: "error",
      timestamp: new Date(nowMs - 60_000).toISOString(),
      data: {
        orderId: "ord_checkout_503",
        statusCode: 503,
        error: "Upstream payment gateway timeout",
        region: "us-east-1",
      },
    },
    null,
    2,
  );

  const stripeSignature = signStripeSignature(
    stripeBody,
    DEMO_WEBHOOK_SECRET,
    Math.floor((nowMs - 180_000) / 1000),
  );
  const githubSignature = signHmacSha256(githubBody, DEMO_WEBHOOK_SECRET);
  const customSignature = signHmacSha256(
    customErrorBody,
    DEMO_WEBHOOK_SECRET,
  ).slice("sha256=".length);

  return [
    {
      id: "req_seed_stripe_01",
      binId: DEMO_BIN_ID,
      method: "POST",
      path: `/api/hook/${DEMO_BIN_ID}`,
      queryJson: JSON.stringify({ env: "production" }),
      headersJson: JSON.stringify({
        "content-type": "application/json",
        "user-agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)",
        "stripe-signature": stripeSignature,
      }),
      rawBody: stripeBody,
      contentType: "application/json",
      sizeBytes: Buffer.byteLength(stripeBody, "utf8"),
      receivedAt: new Date(nowMs - 180_000).toISOString(),
    },
    {
      id: "req_seed_github_02",
      binId: DEMO_BIN_ID,
      method: "POST",
      path: `/api/hook/${DEMO_BIN_ID}`,
      queryJson: JSON.stringify({ source: "github" }),
      headersJson: JSON.stringify({
        "content-type": "application/json",
        "user-agent": "GitHub-Hookshot/7f2a10",
        "x-github-event": "push",
        "x-hub-signature-256": githubSignature,
      }),
      rawBody: githubBody,
      contentType: "application/json",
      sizeBytes: Buffer.byteLength(githubBody, "utf8"),
      receivedAt: new Date(nowMs - 120_000).toISOString(),
    },
    {
      id: "req_seed_custom_03",
      binId: DEMO_BIN_ID,
      method: "POST",
      path: `/api/hook/${DEMO_BIN_ID}`,
      queryJson: JSON.stringify({ channel: "alerts" }),
      headersJson: JSON.stringify({
        "content-type": "application/json",
        "user-agent": "TraceLab-Custom-Webhook/2.0",
        "x-webhook-event": "order.delivery_failed",
        "x-webhook-signature": customSignature,
      }),
      rawBody: customErrorBody,
      contentType: "application/json",
      sizeBytes: Buffer.byteLength(customErrorBody, "utf8"),
      receivedAt: new Date(nowMs - 60_000).toISOString(),
    },
  ];
}

export async function seedDatabase(): Promise<void> {
  ensureSchema();
  const db = getDb();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString();

  const [existingBin] = await db
    .select()
    .from(bins)
    .where(eq(bins.id, DEMO_BIN_ID))
    .limit(1);

  if (!existingBin) {
    await db.insert(bins).values({
      id: DEMO_BIN_ID,
      name: "TraceLab Demo Bin",
      customResponseStatus: 200,
      customResponseBody: '{"received":true,"service":"tracelab-webhooks"}',
      expiresAt,
      createdAt: nowIso,
    });
  } else if (new Date(existingBin.expiresAt).getTime() <= nowMs) {
    await db.update(bins).set({ expiresAt }).where(eq(bins.id, DEMO_BIN_ID));
  }

  const existingRequests = await db
    .select({ id: capturedRequests.id })
    .from(capturedRequests)
    .where(eq(capturedRequests.binId, DEMO_BIN_ID))
    .limit(1);

  if (existingRequests.length === 0) {
    await db
      .insert(capturedRequests)
      .values(buildSeedRequests(nowMs))
      .onConflictDoNothing();
  }
}

const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("seed.ts");

if (isDirectRun) {
  seedDatabase()
    .then(() => {
      closeDb();
      logger.info("[tracelab] Database seeded successfully.");
    })
    .catch((err) => {
      closeDb();
      logger.error({ err }, "[tracelab] Seed failed");
      process.exit(1);
    });
}
