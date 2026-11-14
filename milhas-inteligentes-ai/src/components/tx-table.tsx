import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react";
import { Badge, Table, cx, td, th } from "@/components/ui";
import { DeleteButton } from "@/components/forms/submit";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";
import { TX_LABEL } from "@/lib/labels";
import type { TxView } from "@/server/services/transactions";

export function TxTable({
  rows,
  showProgram = true,
  onDelete,
}: {
  rows: TxView[];
  showProgram?: boolean;
  onDelete?: (f: FormData) => Promise<{ ok: boolean; message?: string } | null | void>;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <th className={th}>Data</th>
          <th className={th}>Tipo</th>
          {showProgram && <th className={th}>Programa</th>}
          <th className={`${th} text-right`}>Pontos</th>
          <th className={th}>Detalhes</th>
          {onDelete && <th className={th}><span className="sr-only">Ações</span></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const Icon = r.transferGroupId ? Repeat : r.points > 0 ? ArrowDownLeft : ArrowUpRight;
          const details = [
            r.description,
            r.cardName && `Cartão ${r.cardIssuer} ${r.cardName}`,
            r.expiresAt && `Validade ${formatDate(r.expiresAt)}`,
            r.costBrl != null && `Custo ${formatBRL(r.costBrl)}`,
          ].filter(Boolean);
          return (
            <tr key={r.id}>
              <td className={`${td} tabular text-ink-2`}>{formatDate(r.occurredOn)}</td>
              <td className={td}>
                <span className="flex items-center gap-2">
                  <Icon className={cx("size-3.5", r.points > 0 ? "text-good-ink" : "text-ink-2")} aria-hidden />
                  {TX_LABEL[r.type]}
                </span>
              </td>
              {showProgram && <td className={td}>{r.programName}</td>}
              <td className={cx(td, "tabular text-right font-medium", r.points > 0 ? "text-good-ink" : "text-ink")}>
                {r.points > 0 ? "+" : "−"}
                {formatPoints(Math.abs(r.points))} <span className="font-normal text-muted">{r.unit}</span>
              </td>
              <td className={`${td} max-w-[340px] whitespace-normal text-xs text-ink-2`}>
                {details.join(" · ") || "—"}
                {r.savingsBrl != null && (
                  <span className="ml-1.5">
                    <Badge tone="good">Economia {formatBRL(r.savingsBrl)}</Badge>
                  </span>
                )}
              </td>
              {onDelete && (
                <td className={`${td} text-right`}>
                  {r.points > 0 && !r.transferGroupId && (
                    <DeleteButton
                      action={onDelete}
                      id={r.id}
                      label="Excluir"
                      confirmText="Excluir este crédito? Só é possível se os pontos ainda não foram usados."
                    />
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
