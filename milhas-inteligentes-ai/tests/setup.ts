import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
// Testes sempre usam o banco de teste — nunca o de desenvolvimento.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString("base64");
