import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/server/env";

export const AGENT_MODEL = "claude-opus-5-5";
/** Fallback do servidor: em caso de recusa por política, outro modelo continua a resposta. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const apiKey = () => env.MILHAS_ANTHROPIC_API_KEY ?? env.ANTHROPIC_API_KEY;

export const agentEnabled = () => Boolean(apiKey());

let client: Anthropic | null = null;
export function getAnthropic() {
  const key = apiKey();
  if (!key) throw new Error("Chave da API do Claude não configurada");
  // baseURL explícito: o SDK leria ANTHROPIC_BASE_URL do ambiente, que em sessões do
  // Claude Code aponta para um endereço interno da própria sessão.
  client ??= new Anthropic({ apiKey: key, baseURL: env.MILHAS_ANTHROPIC_BASE_URL, maxRetries: 2 });
  return client;
}

/** Superfície mínima do SDK usada pelo loop (permite injetar um cliente falso nos testes). */
export type AgentClient = Pick<Anthropic, "beta">;
