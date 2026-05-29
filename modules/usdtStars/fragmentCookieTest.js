import net from "net";
import os from "os";
import {
  getFragmentTokens,
  getFragmentTokensFromEnv,
  fragmentTokenFingerprint,
  getFragmentEnvDiagnostics,
  resolveFragmentTokens,
} from "../tokens/tokensDb.js";
import { verifyFragmentCookiesHttp } from "./fragmentDelivery.js";
import { describeFragmentProxy } from "./fragmentProxy.js";
import { walletEnvDiagnostics } from "./walletEnv.js";

export function checkTorPort9050(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host: "127.0.0.1", port: 9050 });
    s.setTimeout(timeoutMs);
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
}

/**
 * Fragment cookie tekshiruvi (test-fragment-cookie.js va admin API).
 * @param {import("pg").Pool} pool
 * @param {{ source?: "env"|"db"|"auto" }} opts — default `env` (.env kalitlari)
 */
export async function runFragmentCookieTest(pool, opts = {}) {
  const source = opts.source || "env";
  const { tokens, source: tokenSource } = await resolveFragmentTokens(pool, source);
  const dbTokens = await getFragmentTokens(pool);
  const proxy = describeFragmentProxy();

  let tor_port_9050 = null;
  if (proxy.type === "socks") {
    const open = await checkTorPort9050();
    tor_port_9050 = open ? "open" : "CLOSED — systemctl start tor";
  }

  const httpResult = await verifyFragmentCookiesHttp(tokens);

  return {
    ok: Boolean(httpResult.ok),
    ...httpResult,
    token_source: tokenSource,
    token_fingerprint: fragmentTokenFingerprint(tokens),
    db_fingerprint: fragmentTokenFingerprint(dbTokens),
    env: getFragmentEnvDiagnostics(),
    proxy,
    tor_port_9050,
    host: os.hostname(),
  };
}

/** Admin: .env va DB fingerprint (tekshiruvsiz). */
export async function getFragmentCookieStatus(pool) {
  const envTokens = getFragmentTokensFromEnv();
  const dbTokens = await getFragmentTokens(pool);

  return {
    env: getFragmentEnvDiagnostics(),
    wallet: walletEnvDiagnostics(),
    env_fingerprint: fragmentTokenFingerprint(envTokens),
    db_fingerprint: fragmentTokenFingerprint(dbTokens),
    env_ready: Boolean(envTokens.fragment_ssid && envTokens.fragment_token),
    db_ready: Boolean(dbTokens.fragment_ssid && dbTokens.fragment_token),
    fingerprints_match:
      JSON.stringify(fragmentTokenFingerprint(envTokens)) ===
      JSON.stringify(fragmentTokenFingerprint(dbTokens)),
    proxy: describeFragmentProxy(),
  };
}
