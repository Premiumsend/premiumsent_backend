/**
 * Serverda Fragment cookie tekshiruvi (.env yoki DB).
 * Ishlatish: cd backend && node scripts/test-fragment-cookie.js
 * Manba: node scripts/test-fragment-cookie.js db
 */
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import pg from "pg";
import { runFragmentCookieTest } from "../modules/usdtStars/fragmentCookieTest.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL .env da yo'q");
  process.exit(1);
}

const sourceArg = (process.argv[2] || "env").toLowerCase();
const source = sourceArg === "db" || sourceArg === "auto" ? sourceArg : "env";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await runFragmentCookieTest(pool, { source });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} finally {
  await pool.end();
}
