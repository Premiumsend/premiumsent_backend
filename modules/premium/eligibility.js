import { searchRobynRecipient, mapRobynSearchToProfile } from "../robynhoodClient/search.js";
import { robynhoodConfigured } from "../robynhoodClient/client.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const PREMIUM_ALREADY_ACTIVE_MSG =
  "Bu foydalanuvchida allaqachon Telegram Premium faol. Buyurtma ochib bo'lmaydi.";

export const PREMIUM_RECIPIENT_UNAVAILABLE_MSG =
  "Foydalanuvchi topilmadi yoki unga Premium sotib bo'lish mumkin emas.";

function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

export function premiumSubscriptionDurationMs(months) {
  const m = Number(months);
  if (!Number.isFinite(m) || m <= 0) return 91 * DAY_MS;
  if (m === 3) return 91 * DAY_MS;
  if (m === 6) return 183 * DAY_MS;
  if (m === 12) return 365 * DAY_MS;
  return Math.round(m * 30.437) * DAY_MS;
}

function foundIndicatesActivePremium(found) {
  if (!found || typeof found !== "object") return false;
  if (found.has_premium === true || found.is_premium === true || found.premium === true) {
    return true;
  }
  if (found.can_receive_premium === false || found.can_gift_premium === false) {
    return true;
  }
  const st = String(found.status || found.premium_status || "").toLowerCase();
  return ["active", "subscriber", "already", "has_premium"].includes(st);
}

function robynDenialReason(data) {
  const err = String(data?.error || data?.message || data?.detail || "").toLowerCase();
  if (/already|allaqachon|has premium|premium bor|faol|subscriber/i.test(err)) {
    return "already";
  }
  if (!data?.ok || !data?.found) {
    if (/premium/.test(err) && !/topilmadi|not found|yo'q/i.test(err)) {
      return "already";
    }
    return "unavailable";
  }
  return null;
}

export async function userHasActivePremiumInDb(pool, username) {
  const clean = normalizeUsername(username);
  if (!pool || !clean) return false;

  const u = await pool.query(
    `SELECT get_premium_at, last_premium_months FROM users WHERE LOWER(username) = $1 LIMIT 1`,
    [clean]
  );
  const row = u.rows[0];
  if (!row?.get_premium_at) return false;

  const started = new Date(row.get_premium_at).getTime();
  if (!Number.isFinite(started)) return false;

  return Date.now() - started < premiumSubscriptionDurationMs(row.last_premium_months);
}

export async function userHasActivePremiumOrder(pool, username) {
  const clean = normalizeUsername(username);
  if (!pool || !clean) return false;

  const r = await pool.query(
    `SELECT type_amount, created_at FROM orders
     WHERE LOWER(recipient_username) = $1
       AND order_type IN ('premium', 'premium_paymee', 'premium_usdt')
       AND status IN ('completed', 'delivered', 'premium_sent', 'processing', 'paid')
       AND payment_status IN ('paid', 'completed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [clean]
  );

  const row = r.rows[0];
  if (!row) return false;

  const started = new Date(row.created_at).getTime();
  if (!Number.isFinite(started)) return false;

  return Date.now() - started < premiumSubscriptionDurationMs(row.type_amount);
}

/**
 * Premium qabul qiluvchi: faol premium yo'q + Robyn qidiruv (mavjud bo'lsa).
 * @returns {{ ok: true, profile }} | {{ ok: false, code, error }}
 */
export async function checkPremiumRecipientEligibility(pool, username, months = 3) {
  const clean = normalizeUsername(username);
  if (!clean || !/^[a-zA-Z0-9_]{4,32}$/.test(clean)) {
    return { ok: false, code: "INVALID_USERNAME", error: "Username noto'g'ri" };
  }

  const monthsNum = [3, 6, 12].includes(Number(months)) ? Number(months) : 3;

  if (await userHasActivePremiumInDb(pool, clean)) {
    return { ok: false, code: "ALREADY_HAS_PREMIUM", error: PREMIUM_ALREADY_ACTIVE_MSG };
  }

  if (await userHasActivePremiumOrder(pool, clean)) {
    return { ok: false, code: "ALREADY_HAS_PREMIUM", error: PREMIUM_ALREADY_ACTIVE_MSG };
  }

  if (robynhoodConfigured()) {
    try {
      const { data, cleanUsername } = await searchRobynRecipient({
        productType: "premium",
        query: clean,
        months: monthsNum,
      });

      if (foundIndicatesActivePremium(data?.found)) {
        return { ok: false, code: "ALREADY_HAS_PREMIUM", error: PREMIUM_ALREADY_ACTIVE_MSG };
      }

      const denial = robynDenialReason(data);
      if (denial === "already" || denial === "unavailable") {
        return { ok: false, code: "ALREADY_HAS_PREMIUM", error: PREMIUM_ALREADY_ACTIVE_MSG };
      }

      const profile = mapRobynSearchToProfile(data, cleanUsername);
      if (!profile?.recipient) {
        return { ok: false, code: "USER_NOT_FOUND", error: PREMIUM_RECIPIENT_UNAVAILABLE_MSG };
      }

      return { ok: true, profile };
    } catch (err) {
      const msg = String(err.message || "").toLowerCase();
      if (/already|premium.*(active|bor|faol)/i.test(msg)) {
        return { ok: false, code: "ALREADY_HAS_PREMIUM", error: PREMIUM_ALREADY_ACTIVE_MSG };
      }
      return {
        ok: false,
        code: "SEARCH_ERROR",
        error: err.message || PREMIUM_RECIPIENT_UNAVAILABLE_MSG,
      };
    }
  }

  return {
    ok: true,
    profile: {
      username: clean,
      fullName: clean,
      recipient: clean,
      imageUrl: null,
    },
  };
}

export function sendPremiumEligibilityFailure(res, check) {
  const status =
    check.code === "ALREADY_HAS_PREMIUM"
      ? 409
      : check.code === "INVALID_USERNAME"
        ? 400
        : 404;
  return res.status(status).json({ error: check.error, code: check.code });
}
