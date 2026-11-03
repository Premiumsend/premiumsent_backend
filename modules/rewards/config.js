/**
 * Bonuslar qoidalari va almashtirish katalogi.
 *
 * ⚠️ env FUNKSIYA ICHIDA o'qiladi (server.js da dotenv.config() importlardan keyin).
 */

/** Har to'liq 50 Stars xarid uchun xaridorga */
export const STARS_REWARD_PER_50 = 5;
/** Premium'ning har oyi uchun xaridorga: 3 / 6 / 12 oy → 3 / 6 / 12 ⭐ */
export const PREMIUM_REWARD_PER_MONTH = 1;

/** Xaridorga necha ⭐ bonus: 49⭐ → 0, 50⭐ → 5, 120⭐ → 10, Premium 3 oy → 3. Bonus referali yo'q */
export function rewardForOrder(order) {
  const type = String(order?.order_type || "").toLowerCase();
  const amount = Number(order?.type_amount) || 0;
  if (amount <= 0) return 0;
  if (type.includes("premium")) return amount * PREMIUM_REWARD_PER_MONTH;
  if (type.includes("stars")) return Math.floor(amount / 50) * STARS_REWARD_PER_50;
  return 0;
}

/** Telegram username formati (5–32, harf/raqam/_) — qabul qiluvchi uchun */
export function normalizeRecipientUsername(raw) {
  const u = String(raw || "").trim().replace(/^@/, "");
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(u) ? u : null;
}

/** Balansdan yechib olish chegaralari (Stars) */
export const MIN_REDEEM_STARS = 50;
export const MAX_REDEEM_STARS = 10000;

/** Bonus buyurtmalarini oddiy xariddan ajratuvchi order_id prefiksi */
export const REWARD_ORDER_PREFIX = "reward-";

export function isRewardOrder(order) {
  return String(order?.order_id || "").startsWith(REWARD_ORDER_PREFIX);
}

/** Bir kunda barcha userlar yechib olishi mumkin bo'lgan jami ⭐ (favqulodda himoya) */
export function getDailyRedeemCapStars() {
  const n = Number(process.env.BONUS_DAILY_CAP_STARS ?? 3000);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/** Bir user bir kunda nechta marta yechib olishi mumkin */
export function getUserDailyRedeemLimit() {
  const n = Number(process.env.BONUS_USER_DAILY_LIMIT ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
}
