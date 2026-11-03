import {
  MAX_REDEEM_STARS,
  MIN_REDEEM_STARS,
  PREMIUM_REWARD_PER_MONTH,
  REWARD_ORDER_PREFIX,
  STARS_REWARD_PER_50,
  normalizeRecipientUsername,
} from "./config.js";
import { getBalance, getLedger, markSeen } from "./db.js";
import {
  RedeemError,
  claimRedemption,
  createRedemption,
  finalizeRedemption,
  handleRedemptionError,
} from "./service.js";

const RULES = {
  stars_per_50: STARS_REWARD_PER_50,
  premium_per_month: PREMIUM_REWARD_PER_MONTH,
  referral_per_purchase: 0,
};

function tgUserId(req) {
  const id = req.telegramUser?.id;
  return id ? String(id) : null;
}

/** Yetkazish faqat initData'dagi HAQIQIY username'ga (o'ziga) */
function tgUsername(req) {
  return String(req.telegramUser?.username || "").replace(/^@/, "").trim();
}

/**
 * ctx: { pool, bot, telegramAuth, authLimiter, deliverRewardOrder(order),
 *        notifyErrorChannel, sendDeliveredOrderNotify }
 */
export function registerRewardsRoutes(app, ctx) {
  const { pool, telegramAuth, authLimiter } = ctx;

  app.get("/api/rewards/status", telegramAuth, async (req, res) => {
    const userId = tgUserId(req);
    if (!userId) return res.status(401).json({ error: "Telegram autentifikatsiya kerak" });
    try {
      const [balance, ledger, active] = await Promise.all([
        getBalance(pool, userId),
        getLedger(pool, userId, 30),
        pool.query(
          `SELECT id, order_type, type_amount, status FROM orders
           WHERE owner_user_id = $1 AND order_id LIKE $2 AND status IN ('pending', 'processing')
           ORDER BY id DESC LIMIT 1`,
          [userId, `${REWARD_ORDER_PREFIX}%`]
        ),
      ]);
      res.json({
        enabled: true,
        balance,
        rules: RULES,
        min_redeem: MIN_REDEEM_STARS,
        max_redeem: MAX_REDEEM_STARS,
        ledger,
        active_redemption: active.rows[0] || null,
        referral_link: null,
        has_username: Boolean(tgUsername(req)),
      });
    } catch (err) {
      console.error("❌ /api/rewards/status:", err.message);
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  // Pastki menyudagi "Bonuslar" belgisi uchun — hali "Olish" bosilmagan bonuslar soni (yengil COUNT)
  app.get("/api/rewards/unseen", telegramAuth, async (req, res) => {
    const userId = tgUserId(req);
    if (!userId) return res.status(401).json({ error: "Telegram autentifikatsiya kerak" });
    try {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS n FROM bonus_ledger WHERE user_id = $1 AND seen = false AND delta > 0`,
        [userId]
      );
      res.json({ count: r.rows[0]?.n || 0 });
    } catch (err) {
      console.error("❌ /api/rewards/unseen:", err.message);
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  app.post("/api/rewards/seen", telegramAuth, async (req, res) => {
    const userId = tgUserId(req);
    const ledgerId = Number(req.body?.ledger_id);
    if (!userId) return res.status(401).json({ error: "Telegram autentifikatsiya kerak" });
    if (!Number.isInteger(ledgerId) || ledgerId <= 0) return res.status(400).json({ error: "ledger_id kerak" });
    try {
      await markSeen(pool, userId, ledgerId);
      res.json({ success: true });
    } catch (err) {
      console.error("❌ /api/rewards/seen:", err.message);
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  app.post("/api/rewards/redeem", authLimiter, telegramAuth, async (req, res) => {
    const userId = tgUserId(req);
    if (!userId) return res.status(401).json({ error: "Telegram autentifikatsiya kerak" });

    const amount = Number(req.body?.amount);
    if (!Number.isInteger(amount) || amount < MIN_REDEEM_STARS || amount > MAX_REDEEM_STARS) {
      return res.status(400).json({ code: "bad_amount", error: "Noto'g'ri miqdor" });
    }
    const item = { id: "stars", cost: amount, stars: amount };

    // Qabul qiluvchi: user tanlagan username, ko'rsatilmasa — o'zi (initData'dagi haqiqiy username)
    const rawRecipient = String(req.body?.recipient_username || "").trim();
    let username;
    if (rawRecipient) {
      username = normalizeRecipientUsername(rawRecipient);
      if (!username) {
        return res.status(400).json({ code: "bad_recipient", error: "Username noto'g'ri" });
      }
    } else {
      username = tgUsername(req);
      if (!username) {
        return res.status(400).json({ code: "need_username", error: "Qabul qiluvchi username'ini kiriting" });
      }
    }

    let created;
    try {
      created = await createRedemption(pool, {
        userId,
        username,
        item,
      });
    } catch (err) {
      if (err instanceof RedeemError) {
        return res.status(400).json({ code: err.code, error: err.message, ...err.extra });
      }
      console.error(`❌ /api/rewards/redeem (user ${userId}):`, err.message);
      return res.status(500).json({ error: "Server xatosi" });
    }

    const { order, balance } = created;
    console.log(`🎁 Bonus yechib olish: #${order.id} @${username} (${userId}) → ${item.stars} Stars (-${item.cost}⭐)`);

    // Yetkazish fonda — natija /api/rewards/status orqali kuzatiladi
    (async () => {
      try {
        if (!(await claimRedemption(pool, order.id))) return;
        await ctx.deliverRewardOrder(order);
      } catch (err) {
        console.error(`❌ Bonus yetkazish #${order.id}:`, err?.message || err);
        await handleRedemptionError(pool, order.id, err).catch(() => {});
      }
      await finalizeRedemption(ctx, order.id).catch((e) =>
        console.error(`❌ Bonus finalize #${order.id}:`, e.message)
      );
    })();

    res.json({ success: true, order_id: order.id, amount, balance });
  });
}
