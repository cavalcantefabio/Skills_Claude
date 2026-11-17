import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

// Serviço de push simulado: nada sai da máquina.
const sent: { endpoint: string; payload: string }[] = [];
vi.mock("web-push", async () => {
  const real = (await vi.importActual("web-push")) as { default: { generateVAPIDKeys: () => { publicKey: string; privateKey: string } } };
  class WebPushError extends Error {
    constructor(public statusCode: number) {
      super(`push ${statusCode}`);
    }
  }
  return {
    default: {
      generateVAPIDKeys: real.default.generateVAPIDKeys,
      sendNotification: async (sub: { endpoint: string }, payload: string) => {
        if (sub.endpoint.includes("expirado")) throw new WebPushError(410);
        sent.push({ endpoint: sub.endpoint, payload });
        return { statusCode: 201 };
      },
    },
    WebPushError,
  };
});

process.env.CRON_SECRET = "segredo-de-teste-com-mais-de-24-caracteres";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let push: typeof import("@/server/push/send");
let userId: string;

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  push = await import("@/server/push/send");
  const [u] = await db.insert(schema.users).values({ email: "push@teste.dev", passwordHash: "x" }).returning();
  userId = u.id;
  await db.insert(schema.profiles).values({ userId, name: "P" });
});

describe("notificações no celular", () => {
  it("gera as chaves VAPID uma vez e guarda cifradas", async () => {
    const a = await push.vapidKeys();
    const b = await push.vapidKeys();
    expect(a).toEqual(b);
    const [row] = await db.select().from(schema.appSecrets).where(eq(schema.appSecrets.key, "vapid"));
    expect(row.value).not.toContain(a.privateKey);
  });

  it("envia para os aparelhos e apaga inscrição vencida (410)", async () => {
    await db.insert(schema.pushSubscriptions).values([
      { userId, endpoint: "https://push.exemplo.com/ok", p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
      { userId, endpoint: "https://push.exemplo.com/expirado", p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
    ]);
    const r = await push.sendPush(userId, { title: "t", body: "b", url: "/voos" });
    expect(r).toEqual({ sent: 1, devices: 2 });
    const left = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
    expect(left.map((s) => s.endpoint)).toEqual(["https://push.exemplo.com/ok"]);
    expect(left[0].lastSuccessAt).not.toBeNull();
  });

  it("resume os voos que dispararam avisos numa notificação só", async () => {
    sent.length = 0;
    const [run] = await db.insert(schema.flightRuns).values({ userId, trigger: "automatica" }).returning();
    const [alert] = await db.insert(schema.routeAlerts).values({ userId, originCodes: ["CGH"] }).returning();
    const base = { runId: run.id, userId, origin: "CGH", kind: "milhas" as const, programSlug: "smiles", programName: "Smiles", sourceUrl: "https://pontospravoar.com/x" };
    const deals = await db
      .insert(schema.flightDeals)
      .values([
        { ...base, destination: "POA", miles: 14900, dateFrom: "2099-04-06", dateTo: "2099-04-06" },
        { ...base, destination: "FLN", miles: 9600 },
        { ...base, destination: "SSA", miles: 20000 },
      ])
      .returning();
    // Só os dois primeiros dispararam o aviso.
    await db.insert(schema.routeAlertHits).values(deals.slice(0, 2).map((d) => ({ alertId: alert.id, dealId: d.id, userId })));
    const r = await push.notifyFlightHits(userId, deals.map((d) => d.id));
    expect(r).toMatchObject({ sent: 1, deals: 2 });
    const payload = JSON.parse(sent[0].payload);
    expect(payload.title).toBe("2 voos para os seus avisos");
    // O mais barato vem primeiro.
    expect(payload.body).toMatch(/^CGH \(São Paulo\) → FLN \(Florianópolis\): 9\.600 milhas Smiles e mais 1\.$/);
    expect(payload.url).toBe("/voos");
    expect(await push.notifyFlightHits(userId, [])).toMatchObject({ sent: 0 });
  });

  it("rota da agenda exige a senha", async () => {
    const { POST } = await import("@/app/api/cron/voos/route");
    expect((await POST(new Request("http://x/api/cron/voos", { method: "POST" }))).status).toBe(401);
    expect((await POST(new Request("http://x/api/cron/voos", { method: "POST", headers: { authorization: "Bearer errado" } }))).status).toBe(401);
  });
});
