import { buyPremiumViaFragment, isFragmentCookieError } from "../usdtStars/fragmentDelivery.js";
import { usdtPremiumSlotKey } from "./orderCreate.js";

async function notifyFragmentCookieIssue(ctx, order, errMsg) {
  const { bot } = ctx;
  const channelId = process.env.ERROR_LOG_CHANNEL_ID;
  const owner = order.owner_user_id;

  const text =
    `⚠️ <b>Fragment cookie xatosi (Premium)</b>\n` +
    `Buyurtma: #${order.id}\n` +
    `@${order.recipient_username} — ${order.type_amount} oy\n` +
    `To'lov: ${order.summ} so'm (qabul qilingan)\n\n` +
    `<code>${String(errMsg || "").slice(0, 400)}</code>\n\n` +
    `👉 Admin panel → Sozlamalar → cookie yangilang.`;

  if (bot && channelId) {
    try {
      await bot.telegram.sendMessage(channelId, text, { parse_mode: "HTML" });
    } catch (e) {
      console.error("❌ Fragment premium xato kanaliga yuborilmadi:", e.message);
    }
  }

  if (bot && owner) {
    try {
      await bot.telegram.sendMessage(
        owner,
        `⚠️ To'lovingiz qabul qilindi, lekin premium hozir avtomatik yuborilmadi.\n\nAdmin tez orada yuboradi yoki @StarsPaymeeSupport ga yozing.\n\nBuyurtma #${order.id}`
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * premium_usdt buyurtmasini Fragment orqali yetkazish.
 */
export async function sendPremiumViaFragment(order, ctx) {
  const {
    pool,
    releasePriceSlotByOrderId,
    releaseDiscountPriceSlotByOrderId,
    removePriceFromCacheByOrderId,
    sendUnifiedChannelNotification,
    processPremiumReferralBonusByUserId,
  } = ctx;

  const orderId = order.id;
  const username = order.recipient_username || order.recipient;
  const months = order.type_amount;

  console.log("🔹 sendPremiumViaFragment:", { orderId, username, months });

  try {
    const result = await buyPremiumViaFragment(username, months, pool);
    const errMsg = result.error || "";

    if (!result.success) {
      if (isFragmentCookieError(errMsg)) {
        await pool.query(
          `UPDATE orders SET status = 'processing', payment_status = 'paid' WHERE id = $1`,
          [orderId]
        );
        await notifyFragmentCookieIssue(ctx, order, errMsg);
        sendUnifiedChannelNotification(order, "premium_usdt", true).catch(() => {});
        throw new Error(errMsg);
      }

      await pool.query("UPDATE orders SET status = 'failed' WHERE id = $1", [orderId]);
      releasePriceSlotByOrderId(orderId, usdtPremiumSlotKey(months));
      releaseDiscountPriceSlotByOrderId(orderId);
      removePriceFromCacheByOrderId(orderId);
      sendUnifiedChannelNotification(order, "premium_usdt", true).catch(() => {});
      throw new Error(errMsg || "Fragment premium xatosi");
    }

    const txId = result.transaction_id || `fragment_premium_${Date.now()}`;

    await pool.query(
      `UPDATE orders SET status='completed', payment_status='paid', transaction_id=$1 WHERE id=$2`,
      [txId, orderId]
    );

    releasePriceSlotByOrderId(orderId, usdtPremiumSlotKey(months));
    releaseDiscountPriceSlotByOrderId(orderId);
    removePriceFromCacheByOrderId(orderId);

    if (order.owner_user_id && processPremiumReferralBonusByUserId) {
      processPremiumReferralBonusByUserId(order.owner_user_id, order.id).catch((err) =>
        console.error("❌ Premium referral bonus error:", err.message)
      );
    }

    console.log(`✅ Fragment Premium yuborildi: #${orderId} -> ${txId}`);
    sendUnifiedChannelNotification(order, "premium_usdt").catch(() => {});

    return txId;
  } catch (err) {
    console.error("❌ sendPremiumViaFragment error:", err);

    if (!isFragmentCookieError(err.message)) {
      await pool.query("UPDATE orders SET status='error' WHERE id=$1", [orderId]).catch(() => {});
      releasePriceSlotByOrderId(orderId, usdtPremiumSlotKey(months));
      releaseDiscountPriceSlotByOrderId(orderId);
      removePriceFromCacheByOrderId(orderId);
      sendUnifiedChannelNotification(order, "premium_usdt", true).catch(() => {});
    }

    throw err;
  }
}
