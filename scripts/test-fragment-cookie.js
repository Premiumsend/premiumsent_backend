/**
 * Serverda Fragment cookie tekshiruvi (DB dagi haqiqiy qiymatlar).
 * Ishlatish: cd backend && node scripts/test-fragment-cookie.js
 */
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import pg from "pg";
import {
  getFragmentTokens,
  fragmentTokenFingerprint,
} from "../modules/tokens/tokensDb.js";
import net from "net";
import { verifyFragmentCookiesHttp } from "../modules/usdtStars/fragmentDelivery.js";
import { describeFragmentProxy } from "../modules/usdtStars/fragmentProxy.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL .env da yo'q");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const tokens = await getFragmentTokens(pool);
  console.log("token_fingerprint:", JSON.stringify(fragmentTokenFingerprint(tokens), null, 2));
  const proxyInfo = describeFragmentProxy();
  console.log("proxy:", JSON.stringify(proxyInfo, null, 2));

  if (proxyInfo.type === "socks") {
    const torUp = await new Promise((resolve) => {
      const s = net.createConnection({ host: "127.0.0.1", port: 9050 });
      s.setTimeout(3000);
      s.on("connect", () => {
        s.destroy();
        resolve(true);
      });
      s.on("error", () => resolve(false));
      s.on("timeout", () => {
        s.destroy();
        resolve(false);
      });
    });
    console.log("tor_port_9050:", torUp ? "open" : "CLOSED — systemctl start tor");
  }
  const result = await verifyFragmentCookiesHttp(tokens);
  console.log("result:", JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
} finally {
  await pool.end();
}
