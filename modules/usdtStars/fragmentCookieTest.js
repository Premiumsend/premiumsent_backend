import net from "net";
import os from "os";
import {
  getFragmentTokens,
  getFragmentTokensFromEnv,
  fragmentTokenFingerprint,
  getFragmentEnvDiagnostics,
  resolveFragmentTokens,
} from "../tokens/tokensDb.js";
import {
  verifyFragmentCookiesHttp,
  runFragmentPythonCookieVerify,
} from "./fragmentDelivery.js";
import { describeFragmentProxy } from "./fragmentProxy.js";
import { walletEnvDiagnostics, validateFragmentWalletEnv } from "./walletEnv.js";

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
  const wallet = walletEnvDiagnostics();
  const walletCheck = validateFragmentWalletEnv();

  let pyfragment_check = { ok: null, skipped: true, error: null };
  if (walletCheck.ok) {
    const pyResult = await runFragmentPythonCookieVerify(tokens);
    pyfragment_check = {
      ok: Boolean(pyResult.ok),
      skipped: false,
      error: pyResult.error || pyResult.stderr || null,
    };
  } else {
    pyfragment_check = {
      ok: false,
      skipped: true,
      error: walletCheck.error,
    };
  }

  const httpOk = Boolean(httpResult.ok);
  const pyOk = pyfragment_check.ok === true;
  const purchase_ready = httpOk && pyOk && wallet.wallet_ready;

  const hints = [];
  if (httpOk && !pyOk) {
    hints.push(
      "HTTP 200 — sahifa ochiladi, lekin pyfragment sessiya yaroqsiz. fragment.com da qayta login, yangi cookie."
    );
  }
  if (wallet.wallet_ready && httpOk && pyOk) {
    hints.push("Tekshiruv OK. Agar sotib olish xato bersa — hamyonda TON balans va API_KEY ni tekshiring.");
  }
  if (!wallet.wallet_ready) {
    hints.push("SEED (12/18/24 so'z) va API_KEY .env da to'g'ri bo'lishi kerak.");
  }

  return {
    ok: purchase_ready,
    purchase_ready,
    http_check: { ok: httpOk, status: httpResult.status, error: httpResult.error },
    pyfragment_check,
    wallet,
    ...httpResult,
    token_source: tokenSource,
    token_fingerprint: fragmentTokenFingerprint(tokens),
    db_fingerprint: fragmentTokenFingerprint(dbTokens),
    env: getFragmentEnvDiagnostics(),
    proxy,
    tor_port_9050,
    host: os.hostname(),
    hints,
    note:
      "fragment:test-cookie faqat GET sahifani tekshiradi; pyfragment_check — haqiqiy sotib olish sessiyasi.",
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
