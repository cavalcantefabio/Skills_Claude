import { beforeAll, describe, expect, it } from "vitest";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let att: typeof import("@/server/auth/attempts");

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  att = await import("@/server/auth/attempts");
});

describe("clientIpFrom", () => {
  it("ignora o primeiro IP de X-Forwarded-For (forjável) e usa o do proxy", () => {
    expect(att.clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(att.clientIpFrom(new Headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "6.6.6.6" }))).toBe("198.51.100.7");
    expect(att.clientIpFrom(new Headers())).toBe("local");
  });
});

describe("limite de tentativas de login", () => {
  it("bloqueia o e-mail após 10 falhas, mesmo com um IP diferente a cada tentativa", async () => {
    const email = "alvo@teste.dev";
    for (let i = 0; i < att.EMAIL_MAX_FAILURES; i++) {
      expect((await att.loginAllowed(email, `10.0.0.${i}`)).allowed).toBe(true);
      await att.recordLoginAttempt(email, `10.0.0.${i}`, false);
    }
    const r = await att.loginAllowed(email, "10.9.9.9");
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.retryInMinutes).toBeGreaterThanOrEqual(1);
    // Outro e-mail não é afetado.
    expect((await att.loginAllowed("outra@teste.dev", "10.9.9.9")).allowed).toBe(true);
  });

  it("um login bem-sucedido zera a contagem do e-mail", async () => {
    const email = "dona@teste.dev";
    for (let i = 0; i < att.EMAIL_MAX_FAILURES - 1; i++) await att.recordLoginAttempt(email, "1.1.1.1", false);
    await att.recordLoginAttempt(email, "1.1.1.1", true);
    for (let i = 0; i < 3; i++) await att.recordLoginAttempt(email, "1.1.1.1", false);
    expect((await att.loginAllowed(email, "1.1.1.1")).allowed).toBe(true);
  });

  it("bloqueia um IP que testa muitos e-mails diferentes", async () => {
    for (let i = 0; i < att.IP_MAX_FAILURES; i++) await att.recordLoginAttempt(`varredura${i}@teste.dev`, "8.8.4.4", false);
    expect((await att.loginAllowed("qualquer@teste.dev", "8.8.4.4")).allowed).toBe(false);
  });

  it("falhas fora da janela de 15 minutos não contam e registros antigos são apagados", async () => {
    const email = "antigo@teste.dev";
    const old = new Date(Date.now() - 20 * 60_000);
    await db.insert(schema.loginAttempts).values(Array.from({ length: 12 }, () => ({ email, ip: "2.2.2.2", success: false, createdAt: old })));
    expect((await att.loginAllowed(email, "2.2.2.2")).allowed).toBe(true);
    await db.insert(schema.loginAttempts).values({ email, ip: "2.2.2.2", success: false, createdAt: new Date(Date.now() - 2 * 86_400_000) });
    await att.recordLoginAttempt(email, "2.2.2.2", false);
    const rows = await db.select().from(schema.loginAttempts);
    expect(rows.every((r) => r.createdAt.getTime() > Date.now() - 86_400_000)).toBe(true);
  });
});
