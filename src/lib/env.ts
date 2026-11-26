import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./data/tracelab.db"),
  POSTGRES_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3008"),
  WEBHOOK_SECRET: z.string().min(8).default("tracelab-demo-webhook-secret"),
  SKIP_ENV_VALIDATION: z.enum(["true", "false"]).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

function cleanOptional(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function validateEnv(
  raw: Record<string, string | undefined> = process.env,
): AppEnv {
  const skip = raw.SKIP_ENV_VALIDATION === "true";
  const normalized = {
    DATABASE_URL: cleanOptional(raw.DATABASE_URL),
    POSTGRES_URL: cleanOptional(raw.POSTGRES_URL),
    NEXT_PUBLIC_APP_URL: cleanOptional(raw.NEXT_PUBLIC_APP_URL),
    WEBHOOK_SECRET: cleanOptional(raw.WEBHOOK_SECRET),
    SKIP_ENV_VALIDATION:
      raw.SKIP_ENV_VALIDATION === "true" || raw.SKIP_ENV_VALIDATION === "false"
        ? raw.SKIP_ENV_VALIDATION
        : undefined,
  };

  if (skip) {
    return {
      DATABASE_URL: normalized.DATABASE_URL ?? "file:./data/tracelab.db",
      POSTGRES_URL: normalized.POSTGRES_URL,
      NEXT_PUBLIC_APP_URL:
        normalized.NEXT_PUBLIC_APP_URL ?? "http://localhost:3008",
      WEBHOOK_SECRET:
        normalized.WEBHOOK_SECRET ?? "tracelab-demo-webhook-secret",
      SKIP_ENV_VALIDATION: "true",
    };
  }

  return EnvSchema.parse(normalized);
}

export const env = validateEnv();
