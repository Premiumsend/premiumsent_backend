import fetch from "node-fetch";

function getBaseUrl() {
  return String(process.env.STARS_PAYMEE_API_URL || "").replace(/\/$/, "");
}

function getApiKey() {
  return String(process.env.STARS_PAYMEE_API_KEY || "").trim();
}

export function paymeeConfigured() {
  return Boolean(getBaseUrl() && getApiKey());
}

/**
 * StarsPaymee Partner API (docs.md §4)
 */
export async function partnerRequest(path, options = {}) {
  const base = getBaseUrl();
  const apiKey = getApiKey();

  if (!base || !apiKey) {
    const err = new Error("STARS_PAYMEE_API_URL yoki STARS_PAYMEE_API_KEY .env da yo'q");
    err.status = 503;
    throw err;
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

export async function checkPaymeeHealth() {
  return partnerRequest("/health");
}

export async function getPaymeeBalance() {
  return partnerRequest("/balance");
}

export async function deliverStarsViaPaymeeApi(username, stars, orderId) {
  const clean = String(username || "").replace(/^@/, "").trim();
  return partnerRequest("/stars", {
    method: "POST",
    body: JSON.stringify({
      username: clean,
      stars: Number(stars),
      idempotency_key: `starsjoy-stars-${orderId}`,
    }),
  });
}

export async function deliverPremiumViaPaymeeApi(username, months, orderId) {
  const clean = String(username || "").replace(/^@/, "").trim();
  return partnerRequest("/premium", {
    method: "POST",
    body: JSON.stringify({
      username: clean,
      months: Number(months),
      idempotency_key: `starsjoy-premium-${orderId}`,
    }),
  });
}

export function isPaymeeBalanceError(err) {
  return err?.status === 402;
}

export function isPaymeeConfigError(err) {
  return err?.status === 401 || err?.status === 503;
}

export function isPaymeeRetryableError(err) {
  return err?.status === 502 || err?.status === 500;
}
