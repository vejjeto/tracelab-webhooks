import pino from "pino";

export const logger = pino({
  name: "tracelab-webhooks",
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.secret",
      "*.token",
      "*.password",
      "WEBHOOK_SECRET",
      "DATABASE_URL",
      "POSTGRES_URL",
    ],
    censor: "[REDACTED]",
  },
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
