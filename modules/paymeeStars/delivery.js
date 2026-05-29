import {
  deliverStarsViaPaymeeApi,
  isPaymeeBalanceError,
  isPaymeeConfigError,
  isPaymeeRetryableError,
  paymeeConfigured,
} from "../paymeeClient/index.js";
import { paymeeSlotKey } from "./orderCreate.js";

/**
 * stars_paymee buyurtmasini StarsPaymee Partner API orqali yetkazish.
 */
export async function sendStarsViaPaymee(order, ctx) {
  const {
    pool,
    releasePriceSlotByOrderId,
    releaseDiscountPriceSlotByOrderId,
    removePriceFromCacheByOrderId,
    sendUnifiedChannelNotification,
    bot,
  } = ctx;

  const orderId = order.id;
  const username = order.recipient_username || order.recipient;
  const stars = order.type_amount;
  const slotKey = paymeeSlotKey(stars);

  if (!paymeeConfigured()) {
    const msg = "STARS_PAYMEE_API_URL / STARS_PAYMEE_API_KEY .env da sozlang";
    await pool.query(
      `UPDATE orders SET status = 'processing', payment_status = 'paid' WHERE id = $1`,
      [orderId]
    );
    throw new Error(msg);
  }

  console.log("🔹 sendStarsViaPaymee:", { orderId, username, stars });

  try {
    const data = await deliverStarsViaPaymeeApi(username, stars, orderId);

    if (!data?.success) {
      throw new Error(data?.error || "Paymee API xatosi");
    }

    const txId = data.transaction_id || `paymee_${orderId}_${Date.now()}`;

    await pool.query(
      `UPDATE orders SET status='completed', payment_status='paid', transaction_id=$1 WHERE id=$2`,
      [txId, orderId]
    );

    releasePriceSlotByOrderId(orderId, slotKey);
    releaseDiscountPriceSlotByOrderId(orderId);
    removePriceFromCacheByOrderId(orderId);

    console.log(`✅ Paymee Stars yuborildi: #${orderId} -> ${txId}`);
    sendUnifiedChannelNotification(order, "stars_paymee").catch(() => {});

    return { success: true, transaction_id: txId };
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
              `⚠️ Paymee stars #${orderId} (@${username}, ${stars}⭐)\n${errMsg}${extra}`
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
    sendUnifiedChannelNotification(order, "stars_paymee", true).catch(() => {});
    throw err;
  }
}
