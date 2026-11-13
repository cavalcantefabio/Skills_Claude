import { z } from "zod";

/** Campos de formulário chegam como string; "" vira undefined. */
const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/**
 * Aceita formatos pt-BR e internacionais: "1234.5", "1.234,5", "50.000" (= 50 mil),
 * "2,5". Ponto seguido de grupos de 3 dígitos sem vírgula é separador de milhar.
 */
export function parseNumber(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim().replace(/\s|R\$/g, "");
  if (s === "") return undefined;
  let normalized = s;
  if (s.includes(",")) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : v;
}

export const optText = (max = 500) =>
  z.preprocess(blankToUndef, z.string().trim().max(max, `Máximo de ${max} caracteres.`).optional());

export const reqText = (label: string, max = 120) =>
  z.string({ error: `Informe ${label}.` }).trim().min(1, `Informe ${label}.`).max(max, `Máximo de ${max} caracteres.`);

export const money = (label: string, { min = 0, max = 10_000_000 } = {}) =>
  z.preprocess(
    parseNumber,
    z
      .number({ error: `Informe ${label} em número.` })
      .min(min, `${label[0].toUpperCase()}${label.slice(1)} não pode ser menor que ${min}.`)
      .max(max, `Valor muito alto.`),
  );

export const optMoney = (label: string, opts?: { min?: number; max?: number }) =>
  z.preprocess(blankToUndef, money(label, opts).optional());

export const intPoints = (label: string, { min = 1, max = 100_000_000 } = {}) =>
  z.preprocess(
    parseNumber,
    z
      .number({ error: `Informe ${label} em número.` })
      .int("Use um número inteiro.")
      .min(min, `Mínimo: ${min.toLocaleString("pt-BR")}.`)
      .max(max, "Valor muito alto."),
  );

export const optInt = (label: string, opts?: { min?: number; max?: number }) =>
  z.preprocess(blankToUndef, intPoints(label, opts).optional());

export const isoDate = (label: string) =>
  z.string({ error: `Informe ${label}.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Informe ${label} válida.`);

export const optIsoDate = (label: string) => z.preprocess(blankToUndef, isoDate(label).optional());

export const optUuid = z.preprocess(blankToUndef, z.string().uuid().optional());
export const uuid = z.string().uuid("Seleção inválida.");

export type FieldErrors = Record<string, string[] | undefined>;

/** Erros por campo a partir de um ZodError. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
