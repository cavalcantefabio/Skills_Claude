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
  /** Busca na web no chat do agente (passagens, hotéis, roteiros). "false" desliga. */
  AGENT_WEB_SEARCH: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** Atualizações do Radar de Oportunidades por usuário por dia (cada uma usa busca na web). */
  RADAR_DAILY_LIMIT: z.coerce.number().int().positive().default(3),
  /** Buscas de voos com milhas (Alertas de Voos) por usuário por dia (cada uma usa busca na web). */
  FLIGHT_SEARCH_DAILY_LIMIT: z.coerce.number().int().positive().default(4),
  /** Buscas automáticas de voos por dia (a agenda chama /api/cron/voos; o padrão cobre 8h e 20h). */
  FLIGHT_AUTO_SEARCHES_PER_DAY: z.coerce.number().int().min(0).max(6).default(2),
  /** Senha da agenda (GitHub Actions) para chamar /api/cron/voos. Sem ela, a rota fica desligada. */
  CRON_SECRET: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(24, "CRON_SECRET precisa de pelo menos 24 caracteres.").optional(),
  ),
  /** Contato exigido pelos serviços de notificação (mailto: ou https:). */
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:|https:\/\/)/)
    .default("mailto:alertas@milhas-inteligentes.app"),
  /** Pesquisas de referência de viagem por usuário por dia (cada uma usa busca na web). */
  TRIP_RESEARCH_DAILY_LIMIT: z.coerce.number().int().positive().default(5),
  /** Conexões simultâneas por instância. Em hospedagem serverless (Vercel), use poucas. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/** Variáveis de ambiente validadas. Só pode ser importado no servidor. */
export const env = schema.parse(process.env);
