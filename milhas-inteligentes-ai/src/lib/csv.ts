/**
 * CSV no padrão do Excel em português: separador ";", vírgula decimal e BOM UTF-8
 * (para acentos abrirem corretamente).
 */
export type CsvValue = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(v: CsvValue): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  let s = String(v);
  // Proteção contra injeção de fórmula: texto que começa com =, +, -, @ não vira fórmula no Excel.
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: { header: string; value: (r: T) => CsvValue }[]) {
  const lines = [columns.map((c) => cell(c.header)).join(";"), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(";"))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}
