-- Importa o uso das respostas já registradas (antes desta versão) para agent_usage,
-- com a tabela de preços do Claude Opus 5.5 (escrita de cache estimada como 5 minutos).
INSERT INTO "agent_usage" ("user_id", "conversation_id", "model", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "cost_usd", "created_at")
SELECT
  c."user_id",
  m."conversation_id",
  'claude-opus-5-5',
  COALESCE((m."usage"->>'input_tokens')::int, 0),
  COALESCE((m."usage"->>'output_tokens')::int, 0),
  COALESCE((m."usage"->>'cache_read_input_tokens')::int, 0),
  COALESCE((m."usage"->>'cache_creation_input_tokens')::int, 0),
  (
    COALESCE((m."usage"->>'input_tokens')::int, 0) * 4.0
    + COALESCE((m."usage"->>'output_tokens')::int, 0) * 20.0
    + COALESCE((m."usage"->>'cache_read_input_tokens')::int, 0) * 0.2
    + COALESCE((m."usage"->>'cache_creation_input_tokens')::int, 0) * 5.0
  ) / 1000000,
  m."created_at"
FROM "agent_messages" m
JOIN "agent_conversations" c ON c."id" = m."conversation_id"
WHERE m."role" = 'assistant' AND m."usage" IS NOT NULL;
