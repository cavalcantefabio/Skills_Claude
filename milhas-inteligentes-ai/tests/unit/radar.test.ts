import { describe, expect, it } from "vitest";
import { opportunityInsight, received } from "@/lib/radar";

const accounts = [
  { programSlug: "livelo", programName: "Livelo", unit: "pontos", balance: 40_000, milheiroValueBrl: 35 },
  { programSlug: "smiles", programName: "Smiles", unit: "milhas", balance: 10_000, milheiroValueBrl: 20 },
];
const base = { ratioFrom: 1, ratioTo: 1, discountPct: null, pricePerThousandBrl: null };

describe("radar", () => {
  it("calcula milhas recebidas com paridade e bônus", () => {
    expect(received(40_000, 1, 1, 100)).toBe(80_000);
    expect(received(10_001, 2, 1, 0)).toBe(5000);
  });

  it("transferência com bônus alto fica favorável frente ao milheiro de destino", () => {
    const r = opportunityInsight({ kind: "transferencia", fromSlug: "livelo", toSlug: "smiles", bonusPct: 100, ...base }, accounts);
    expect(r.relevant).toBe(true);
    // 40.000 × R$ 35/mil = R$ 1.400 por 80.000 milhas = R$ 17,50/mil < R$ 20
    expect(r.tone).toBe("favoravel");
    expect(r.lines.join(" ")).toContain("80.000");
    expect(r.lines.join(" ")).toContain("17,50");
  });

  it("transferência sem bônus fica desfavorável quando a origem vale mais", () => {
    const r = opportunityInsight({ kind: "transferencia", fromSlug: "livelo", toSlug: "smiles", bonusPct: 0, ...base }, accounts);
    expect(r.tone).toBe("desfavoravel");
  });

  it("compra de milhas compara o custo efetivo com o milheiro de referência", () => {
    const r = opportunityInsight(
      { kind: "compra", fromSlug: null, toSlug: "smiles", bonusPct: 25, ratioFrom: null, ratioTo: null, discountPct: 50, pricePerThousandBrl: 20 },
      accounts,
    );
    // R$ 20 / 1,25 = R$ 16 < R$ 20
    expect(r.tone).toBe("favoravel");
  });

  it("promoção de programa que a pessoa não tem não é relevante", () => {
    const r = opportunityInsight({ kind: "transferencia", fromSlug: "esfera", toSlug: "azul-fidelidade", bonusPct: 50, ...base }, accounts);
    expect(r.relevant).toBe(false);
    expect(r.lines).toHaveLength(0);
  });
});
