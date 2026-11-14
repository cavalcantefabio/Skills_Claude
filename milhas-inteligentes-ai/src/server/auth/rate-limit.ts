import "server-only";

/**
 * Limitador em memória (janela deslizante simples) para tentativas de login.
 * Suficiente para o MVP em instância única; em produção com várias instâncias,
 * trocar por Redis ou tabela no Postgres.
 */
const attempts = new Map<string, number[]>();

export function rateLimit(key: string, max = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
