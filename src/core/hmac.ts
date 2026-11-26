import { createHmac, timingSafeEqual } from "node:crypto";

export const SUPPORTED_SIGNATURE_HEADERS = [
  "stripe-signature",
  "x-hub-signature-256",
  "x-webhook-signature",
  "x-signature-256",
] as const;

export interface HmacVerificationResult {
  valid: boolean;
  format: "github" | "stripe" | "raw" | "invalid";
  expectedPrefixed: string;
}

function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function signHmacSha256(payload: string, secret: string): string {
  return `sha256=${hmacSha256Hex(payload, secret)}`;
}

export function signStripeSignature(
  payload: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const sig = hmacSha256Hex(`${timestamp}.${payload}`, secret);
  return `t=${timestamp},v1=${sig}`;
}

function timingSafeCompareStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a.toLowerCase(), "utf8");
  const bufB = Buffer.from(b.toLowerCase(), "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function parseStripeHeader(
  header: string,
): { timestamp: string; signatures: string[] } | null {
  const parts = header.split(",").map((part) => part.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key === "t" && val) timestamp = val;
    if (key === "v1" && val) signatures.push(val);
  }

  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null | undefined,
  secret: string,
): HmacVerificationResult {
  const expectedPrefixed = secret ? signHmacSha256(payload, secret) : "";
  if (!signatureHeader || !secret) {
    return { valid: false, format: "invalid", expectedPrefixed };
  }

  const trimmed = signatureHeader.trim();
  const stripe = parseStripeHeader(trimmed);
  if (stripe) {
    const expectedHex = hmacSha256Hex(`${stripe.timestamp}.${payload}`, secret);
    const valid = stripe.signatures.some((sig) =>
      timingSafeCompareStrings(sig, expectedHex),
    );
    return {
      valid,
      format: valid ? "stripe" : "invalid",
      expectedPrefixed: `t=${stripe.timestamp},v1=${expectedHex}`,
    };
  }

  const expectedHex = expectedPrefixed.slice("sha256=".length);
  if (trimmed.startsWith("sha256=")) {
    const receivedHex = trimmed.slice("sha256=".length);
    const valid = timingSafeCompareStrings(receivedHex, expectedHex);
    return { valid, format: valid ? "github" : "invalid", expectedPrefixed };
  }

  const valid = timingSafeCompareStrings(trimmed, expectedHex);
  return { valid, format: valid ? "raw" : "invalid", expectedPrefixed };
}

export function extractSignatureHeader(
  headers: Record<string, string>,
): { headerName: string; value: string } | null {
  const entries = Object.entries(headers);
  for (const target of SUPPORTED_SIGNATURE_HEADERS) {
    const match = entries.find(([key]) => key.toLowerCase() === target);
    if (match?.[1].trim()) {
      return { headerName: match[0], value: match[1] };
    }
  }
  return null;
}
