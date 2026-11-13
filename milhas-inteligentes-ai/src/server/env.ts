import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "APP_ENCRYPTION_KEY deve ter 32 bytes em base64"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/** Variáveis de ambiente validadas. Só pode ser importado no servidor. */
export const env = schema.parse(process.env);
