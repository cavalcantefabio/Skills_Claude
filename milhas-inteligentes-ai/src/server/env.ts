import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "APP_ENCRYPTION_KEY deve ter 32 bytes em base64"),
  /**
   * Chave da API do Claude. Sem ela, o Agente Inteligente fica desativado (o resto do app funciona).
   * MILHAS_ANTHROPIC_API_KEY tem prioridade: em sessões do Claude Code o nome ANTHROPIC_API_KEY é
   * reservado pela plataforma e não chega ao app.
   */
  MILHAS_ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Endereço da API. Fixo por padrão: não herdamos ANTHROPIC_BASE_URL de ferramentas do ambiente. */
  MILHAS_ANTHROPIC_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  /** Mensagens por usuário por dia enviadas ao agente (controle de custo). */
  AGENT_DAILY_MESSAGE_LIMIT: z.coerce.number().int().positive().default(60),
  /**
   * Cadastro de novas contas. Por padrão só é permitido enquanto não existe nenhuma conta
   * (app de uso pessoal: a primeira conta fecha o cadastro). "true" mantém o cadastro aberto.
   */
  ALLOW_SIGNUP: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Conexões simultâneas por instância. Em hospedagem serverless (Vercel), use poucas. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/** Variáveis de ambiente validadas. Só pode ser importado no servidor. */
export const env = schema.parse(process.env);
