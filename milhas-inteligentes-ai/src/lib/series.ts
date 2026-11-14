import { monthOf } from "./dates";

export type TxLite = { accountId: string; points: number; occurredOn: string };

/**
 * Saldo de cada conta ao fim de cada mês do intervalo.
 * Nunca soma contas diferentes: retorna uma série por conta.
 */
export function monthlyBalances(txs: TxLite[], months: string[], accountIds: string[]) {
  const first = months[0];
  const opening = new Map<string, number>(accountIds.map((id) => [id, 0]));
  const perMonth = new Map<string, Map<string, number>>();
  for (const t of txs) {
    const ym = monthOf(t.occurredOn);
    if (ym < first) {
      opening.set(t.accountId, (opening.get(t.accountId) ?? 0) + t.points);
      continue;
    }
    if (!perMonth.has(ym)) perMonth.set(ym, new Map());
    const m = perMonth.get(ym)!;
    m.set(t.accountId, (m.get(t.accountId) ?? 0) + t.points);
  }
  const running = new Map(opening);
  return months.map((ym) => {
    const row: Record<string, number | string> = { month: ym };
    const deltas = perMonth.get(ym);
    for (const id of accountIds) {
      const v = (running.get(id) ?? 0) + (deltas?.get(id) ?? 0);
      running.set(id, v);
      row[id] = v;
    }
    return row;
  });
}

/** Soma valores por mês: entrada genérica { month, value }. */
export function bucketByMonth<T>(items: T[], months: string[], key: (i: T) => string, value: (i: T) => number) {
  const map = new Map(months.map((m) => [m, 0]));
  for (const i of items) {
    const ym = monthOf(key(i));
    if (map.has(ym)) map.set(ym, map.get(ym)! + value(i));
  }
  return months.map((m) => ({ month: m, value: map.get(m)! }));
}
