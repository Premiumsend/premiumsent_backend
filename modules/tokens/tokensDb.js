/** Fragment cookie kalitlari — `tokens` jadvalida saqlanadi */
export const FRAGMENT_TOKEN_KEYS = [
  "fragment_dt",
  "fragment_ssid",
  "fragment_token",
  "fragment_ton_token",
];

const DEFAULTS = {
  fragment_dt: "-300",
  fragment_ssid: "",
  fragment_token: "",
  fragment_ton_token: "",
};

let cache = null;
let cacheAt = 0;
const CACHE_TTL_MS = 30_000;

export function invalidateFragmentTokenCache() {
  cache = null;
  cacheAt = 0;
}

/**
 * `tokens` jadvalidan Fragment cookie qiymatlarini o'qish.
 */
export async function getFragmentTokens(pool) {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return { ...cache };
  }

  const result = await pool.query(
    `SELECT key, value FROM tokens WHERE key = ANY($1::text[])`,
    [FRAGMENT_TOKEN_KEYS]
  );

  const map = { ...DEFAULTS };
  for (const row of result.rows) {
    if (row.key && row.value != null) {
      map[row.key] = String(row.value).trim();
    }
  }

  cache = map;
  cacheAt = Date.now();
  return { ...map };
}

export function fragmentTokensReady(tokens) {
  return Boolean(tokens?.fragment_ssid && tokens?.fragment_token);
}

export function maskTokenValue(val, show = 4) {
  const v = String(val || "").trim();
  if (!v) return "(yo'q)";
  if (v.length <= show * 2) return `len=${v.length}`;
  return `${v.slice(0, show)}...${v.slice(-show)} (len=${v.length})`;
}

export function maskFragmentTokens(tokens) {
  return {
    fragment_dt: tokens.fragment_dt || DEFAULTS.fragment_dt,
    fragment_ssid: maskTokenValue(tokens.fragment_ssid),
    fragment_token: maskTokenValue(tokens.fragment_token),
    fragment_ton_token: maskTokenValue(tokens.fragment_ton_token),
  };
}

/** Lokal vs server token bir xilmi — uzunlik va bosh/oxir belgilar */
export function fragmentTokenFingerprint(tokens) {
  const fp = (v) => {
    const s = String(v || "").trim();
    if (!s) return { len: 0, head: "", tail: "" };
    return {
      len: s.length,
      head: s.slice(0, 6),
      tail: s.slice(-6),
    };
  };
  return {
    fragment_dt: tokens.fragment_dt || DEFAULTS.fragment_dt,
    fragment_ssid: fp(tokens.fragment_ssid),
    fragment_token: fp(tokens.fragment_token),
    fragment_ton_token: fp(tokens.fragment_ton_token),
    has_ton_token: Boolean(String(tokens.fragment_ton_token || "").trim()),
  };
}

/**
 * Jadval bo'sh bo'lsa .env dan bir martalik seed (migratsiya).
 */
export async function seedFragmentTokensFromEnvIfEmpty(pool) {
  const countRes = await pool.query("SELECT COUNT(*)::int AS c FROM tokens");
  if (countRes.rows[0].c > 0) return false;

  const envMap = {
    fragment_dt: process.env.FRAGMENT_DT || process.env.STEL_DT || DEFAULTS.fragment_dt,
    fragment_ssid: process.env.FRAGMENT_SSID || process.env.STEL_SSID || "",
    fragment_token: process.env.FRAGMENT_TOKEN || process.env.STEL_TOKEN || "",
    fragment_ton_token:
      process.env.FRAGMENT_TON_TOKEN || process.env.STEL_TON_TOKEN || "",
  };

  for (const key of FRAGMENT_TOKEN_KEYS) {
    await pool.query(
      `INSERT INTO tokens (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [key, envMap[key] || ""]
    );
  }

  invalidateFragmentTokenCache();
  console.log("📦 tokens jadvali .env dan birinchi marta to'ldirildi");
  return true;
}

export async function setFragmentTokens(pool, data) {
  for (const key of FRAGMENT_TOKEN_KEYS) {
    if (data[key] === undefined) continue;
    await pool.query(
      `INSERT INTO tokens (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, String(data[key] ?? "").trim()]
    );
  }
  invalidateFragmentTokenCache();
}

/** Python subprocess uchun env obyekti */
export function fragmentTokensToProcessEnv(baseEnv, tokens) {
  return {
    ...baseEnv,
    FRAGMENT_DT: tokens.fragment_dt || DEFAULTS.fragment_dt,
    FRAGMENT_SSID: tokens.fragment_ssid || "",
    FRAGMENT_TOKEN: tokens.fragment_token || "",
    FRAGMENT_TON_TOKEN: tokens.fragment_ton_token || "",
    FRAGMENT_USE_DB_TOKENS: "1",
  };
}

export async function ensureTokensTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tokens (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/** Admin panel: Stars/Premium yo‘li — robynhood | fragment */
export const STARS_PURCHASE_MODE_KEY = "stars_purchase_mode";

export async function getStarsPurchaseModeFromDb(pool) {
  const r = await pool.query(`SELECT value FROM tokens WHERE key = $1`, [
    STARS_PURCHASE_MODE_KEY,
  ]);
  const v = String(r.rows[0]?.value || "").trim();
  return v === "fragment" ? "fragment" : "robynhood";
}

export async function setStarsPurchaseModeInDb(pool, mode) {
  const m = mode === "fragment" ? "fragment" : "robynhood";
  await pool.query(
    `INSERT INTO tokens (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [STARS_PURCHASE_MODE_KEY, m]
  );
  return m;
}

/** Birinchi marta: .env STARS_PURCHASE_MODE (ixtiyoriy), keyin faqat admin */
export async function seedStarsPurchaseModeFromEnvIfMissing(pool) {
  const r = await pool.query(`SELECT 1 FROM tokens WHERE key = $1`, [STARS_PURCHASE_MODE_KEY]);
  if (r.rows.length) return false;
  const envMode =
    process.env.STARS_PURCHASE_MODE === "fragment" ? "fragment" : "robynhood";
  await setStarsPurchaseModeInDb(pool, envMode);
  console.log(`📦 stars_purchase_mode DB ga seed: ${envMode}`);
  return true;
}
