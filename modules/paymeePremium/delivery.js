import {
  deliverPremiumViaPaymeeApi,
  isPaymeeBalanceError,
  isPaymeeConfigError,
  isPaymeeRetryableError,
  paymeeConfigured,
} from "../paymeeClient/index.js";
import { paymeePremiumSlotKey } from "./orderCreate.js";

/**
 * premium_paymee buyurtmasini StarsPaymee Partner API orqali yetkazish.
 */
export async function sendPremiumViaPaymee(order, ctx) {
  const {
    pool,
    releasePriceSlotByOrderId,
    releaseDiscountPriceSlotByOrderId,
    removePriceFromCacheByOrderId,
    sendUnifiedChannelNotification,
    processPremiumReferralBonusByUserId,
    bot,
  } = ctx;

  const orderId = order.id;
  const username = order.recipient_username || order.recipient;
  const months = order.type_amount;
  const slotKey = paymeePremiumSlotKey(months);

  if (!paymeeConfigured()) {
    const msg = "STARS_PAYMEE_API_URL / STARS_PAYMEE_API_KEY .env da sozlang";
    await pool.query(
      `UPDATE orders SET status = 'processing', payment_status = 'paid' WHERE id = $1`,
      [orderId]
    );
    throw new Error(msg);
  }

  console.log("🔹 sendPremiumViaPaymee:", { orderId, username, months });

  try {
    const data = await deliverPremiumViaPaymeeApi(username, months, orderId);

    if (!data?.success) {
      throw new Error(data?.error || "Paymee API xatosi");
    }

    const txId = data.transaction_id || `paymee_premium_${orderId}_${Date.now()}`;

    await pool.query(
      `UPDATE orders SET status='completed', payment_status='paid', transaction_id=$1 WHERE id=$2`,
      [txId, orderId]
    );

    releasePriceSlotByOrderId(orderId, slotKey);
    releaseDiscountPriceSlotByOrderId(orderId);
    removePriceFromCacheByOrderId(orderId);

    if (order.owner_user_id && processPremiumReferralBonusByUserId) {
      processPremiumReferralBonusByUserId(order.owner_user_id, order.id).catch((err) =>
        console.error("❌ Premium referral bonus error:", err.message)
      );
    }

    console.log(`✅ Paymee Premium yuborildi: #${orderId} -> ${txId}`);
    sendUnifiedChannelNotification(order, "premium_paymee").catch(() => {});

    return txId;
  } catch (err) {
    const errMsg = err.message || String(err);

    if (isPaymeeBalanceError(err) || isPaymeeConfigError(err) || isPaymeeRetryableError(err)) {
      await pool.query(
        `UPDATE orders SET status = 'processing', payment_status = 'paid' WHERE id = $1`,
        [orderId]
      );
      if (bot && process.env.ADMIN_IDS) {
        const admins = String(process.env.ADMIN_IDS)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        const extra =
          isPaymeeBalanceError(err) && err.body?.required_usdt != null
            ? `\nKerak: ${err.body.required_usdt} USDT, qolgan: ${err.body.balance_usdt}`
            : "";
        for (const adminId of admins) {
          bot.telegram
            .sendMessage(
              adminId,
              `⚠️ Paymee premium #${orderId} (@${username}, ${months} oy)\n${errMsg}${extra}`
            )
            .catch(() => {});
        }
      }
      throw err;
    }

    await pool.query("UPDATE orders SET status = 'failed' WHERE id = $1", [orderId]);
    releasePriceSlotByOrderId(orderId, slotKey);
    releaseDiscountPriceSlotByOrderId(orderId);
    removePriceFromCacheByOrderId(orderId);
    sendUnifiedChannelNotification(order, "premium_paymee", true).catch(() => {});
    throw err;
  }
}
