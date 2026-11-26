import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number.parseInt(n, 10));
  if (
    parts.length !== 4 ||
    parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)
  ) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

export function isBlockedIpAddress(rawIp: string): boolean {
  const ip = rawIp
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version !== 6) return true;

  if (ip === "::" || ip === "::1") return true;
  if (ip.startsWith("::ffff:")) {
    return isBlockedIpv4(ip.slice("::ffff:".length));
  }
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (
    ip.startsWith("fe8") ||
    ip.startsWith("fe9") ||
    ip.startsWith("fea") ||
    ip.startsWith("feb")
  ) {
    return true;
  }
  if (ip.startsWith("ff")) return true;
  return false;
}

export interface SsrfValidationResult {
  allowed: boolean;
  normalizedUrl?: string;
  reason?: string;
}

export async function validateSafeExternalUrl(
  rawUrl: string,
): Promise<SsrfValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "SSRF guard: URL inválida" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      allowed: false,
      reason: `SSRF guard: protocolo '${parsed.protocol}' no permitido`,
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return {
      allowed: false,
      reason: `SSRF guard: hostname '${hostname}' bloqueado`,
    };
  }

  if (isIP(hostname) !== 0) {
    if (isBlockedIpAddress(hostname)) {
      return {
        allowed: false,
        reason: `SSRF guard: IP privada o reservada (${hostname})`,
      };
    }
    return { allowed: true, normalizedUrl: parsed.toString() };
  }

  try {
    const resolved = await lookup(hostname, { all: true });
    if (resolved.length === 0) {
      return {
        allowed: false,
        reason: `SSRF guard: DNS sin registros para '${hostname}'`,
      };
    }
    for (const entry of resolved) {
      if (isBlockedIpAddress(entry.address)) {
        return {
          allowed: false,
          reason: `SSRF guard: '${hostname}' resuelve a IP bloqueada (${entry.address})`,
        };
      }
    }
    return { allowed: true, normalizedUrl: parsed.toString() };
  } catch {
    return {
      allowed: false,
      reason: `SSRF guard: no se pudo resolver DNS para '${hostname}'`,
    };
  }
}
