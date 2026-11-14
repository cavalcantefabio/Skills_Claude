import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  const cols = [
    { header: "Data", value: (r: { d: string; n: number | null; t: string }) => r.d },
    { header: "Pontos", value: (r: { d: string; n: number | null; t: string }) => r.n },
    { header: "Descrição", value: (r: { d: string; n: number | null; t: string }) => r.t },
  ];

  it("usa ; como separador, vírgula decimal e BOM", () => {
    const out = toCsv([{ d: "2026-11-15", n: 1234.5, t: "Bônus" }], cols);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe("﻿Data;Pontos;Descrição\r\n2026-11-15;1234,5;Bônus\r\n");
  });

  it("escapa aspas, ponto e vírgula e quebras de linha", () => {
    const out = toCsv([{ d: "x", n: null, t: 'Passagem "GRU"; ida\nvolta' }], cols);
    expect(out).toContain('"Passagem ""GRU""; ida\nvolta"');
    expect(out).toContain("x;;");
  });

  it("neutraliza fórmulas (injeção em planilhas)", () => {
    const out = toCsv([{ d: "=HYPERLINK(\"http://x\")", n: -500, t: "@SUM(A1)" }], cols);
    expect(out).toContain("'=HYPERLINK");
    expect(out).toContain("'@SUM(A1)");
    expect(out).toContain(";-500;"); // números negativos continuam números
  });
});
