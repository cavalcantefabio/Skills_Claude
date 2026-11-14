import { getCurrentUser } from "@/server/auth/session";
import { buildExport, lotsCsv, transactionsCsv } from "@/server/services/export";
import { todayISO } from "@/lib/dates";

/** Download dos dados da pessoa logada. ?arquivo=completo | movimentacoes | saldos */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const arquivo = new URL(request.url).searchParams.get("arquivo") ?? "completo";
  const stamp = todayISO();
  const headers = (type: string, name: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${name}"`,
    // Dados financeiros: nunca guardar em cache.
    "Cache-Control": "no-store, private",
  });

  if (arquivo === "completo") {
    const data = await buildExport(user.id);
    return new Response(JSON.stringify(data, null, 2), {
      headers: headers("application/json; charset=utf-8", `milhas-inteligentes-backup-${stamp}.json`),
    });
  }
  if (arquivo === "movimentacoes") {
    return new Response(await transactionsCsv(user.id), {
      headers: headers("text/csv; charset=utf-8", `milhas-inteligentes-movimentacoes-${stamp}.csv`),
    });
  }
  if (arquivo === "saldos") {
    return new Response(await lotsCsv(user.id), {
      headers: headers("text/csv; charset=utf-8", `milhas-inteligentes-saldos-${stamp}.csv`),
    });
  }
  return Response.json({ error: "Arquivo inválido." }, { status: 400 });
}
