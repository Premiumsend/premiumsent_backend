/** Userbot stars minimal balans (.env GIFT_BALANCE) */
export function getGiftBalanceMin() {
  const n = parseInt(process.env.GIFT_BALANCE, 10);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

export function getRefillStarsAmount() {
  const n = parseInt(process.env.GIFT_REFILL_STARS, 10);
  return Number.isFinite(n) && n >= 50 ? n : 50;
}

export function getRefillRecipientUsername() {
  const raw = String(process.env.GIFT_REFILL_USERNAME || "StarsjoySupport")
    .trim()
    .replace(/^@/, "");
  return raw || "StarsjoySupport";
}

export function getRefillCooldownMs() {
  const n = parseInt(process.env.GIFT_REFILL_COOLDOWN_MS, 10);
  return Number.isFinite(n) && n >= 60_000 ? n : 3 * 60 * 1000;
}

export function getBalanceCheckerUrl() {
  const port = parseInt(process.env.BALANCE_CHECKER_PORT, 10) || 6002;
  return process.env.BALANCE_CHECKER_URL || `http://127.0.0.1:${port}`;
}

export function getInternalSecret() {
  return process.env.INTERNAL_API_SECRET || "";
}
