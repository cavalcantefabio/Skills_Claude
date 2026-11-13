import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/server/env";

export const AGENT_MODEL = "claude-opus-5-5";
/** Fallback do servidor: em caso de recusa por política, outro modelo continua a resposta. */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const agentEnabled = () => Boolean(env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export function getAnthropic() {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada");
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

/** Superfície mínima do SDK usada pelo loop (permite injetar um cliente falso nos testes). */
export type AgentClient = Pick<Anthropic, "beta">;
