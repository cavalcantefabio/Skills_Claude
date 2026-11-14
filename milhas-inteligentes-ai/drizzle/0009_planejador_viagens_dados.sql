-- Viagens existentes: "datas flexíveis" vira ±3 dias.
UPDATE "trips" SET "flex_days" = 3 WHERE "flexible_dates" = true AND "flex_days" = 0;

-- Meta e preço antigos (totais da viagem) viram cotações reais por passageiro.
INSERT INTO "trip_quotes" ("trip_id", "user_id", "kind", "certainty", "program_id", "miles_per_pax", "covers", "checked_on", "notes")
SELECT t."id", t."user_id", 'milhas', 'real', t."program_id", CEIL(t."miles_needed"::numeric / t."passengers")::int, 'ida_volta',
       t."updated_at"::date, 'Migrado da meta de milhas anterior'
FROM "trips" t
WHERE t."miles_needed" IS NOT NULL AND t."program_id" IS NOT NULL;

INSERT INTO "trip_quotes" ("trip_id", "user_id", "kind", "certainty", "cash_per_pax_brl", "covers", "checked_on", "notes")
SELECT t."id", t."user_id", 'dinheiro', 'real', ROUND(t."cash_price_brl" / t."passengers", 2), 'ida_volta',
       t."updated_at"::date, 'Migrado do preço em dinheiro anterior'
FROM "trips" t
WHERE t."cash_price_brl" IS NOT NULL AND t."cash_price_brl" > 0;
