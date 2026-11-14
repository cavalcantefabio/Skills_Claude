import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

config({ path: ".env.local" });

/** Aplica as migrações pendentes. Uso: pnpm db:migrate [DATABASE_URL opcional] */
async function main() {
  // Na Vercel + Neon, migrações usam a conexão direta (sem pooler), se existir.
  const url = process.argv[2] ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrações aplicadas.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
