import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Recria o schema do banco de teste do zero e aplica as migrações. */
export async function resetTestDatabase() {
  const url = process.env.DATABASE_URL!;
  if (!/_test\b|_test$/.test(new URL(url).pathname)) {
    throw new Error(`Recusando resetar um banco que não é de teste: ${url}`);
  }
  const pool = new Pool({ connectionString: url });
  await pool.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
