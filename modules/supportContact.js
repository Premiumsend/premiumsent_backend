/** Yordam / admin Telegram — https://t.me/PremiumSend_jbot */
export const SUPPORT_TELEGRAM_USERNAME = (
  process.env.SUPPORT_TELEGRAM_USERNAME || "PremiumSend_jbot"
)
  .trim()
  .replace(/^@/, "");

export const SUPPORT_TELEGRAM_URL = `https://t.me/${SUPPORT_TELEGRAM_USERNAME}`;
export const SUPPORT_TELEGRAM_MENTION = `@${SUPPORT_TELEGRAM_USERNAME}`;

/** @param {string} actionPhrase masalan: "stars sotib olish", "premium (Paymee) sotib olish" */
export function expiredPaymentNotifyText(actionPhrase, { short = false } = {}) {
  if (short) {
    return `⚠️ Siz ${actionPhrase}ga harakat qildingiz, ammo to'lov amalga oshirilmadi.\n\n👉 ${SUPPORT_TELEGRAM_MENTION}`;
  }
  return `⚠️ Siz ${actionPhrase}ga harakat qildingiz, ammo to'lov amalga oshirilmadi.

Agar qandaydir muammo yuzaga kelgan bo'lsa, yordam markaziga yozing:

👉 ${SUPPORT_TELEGRAM_MENTION}`;
}

export function deliveryFailedNotifyText(productType, orderId) {
  const label = productType === "premium" ? "premium" : "stars";
  return `⚠️ To'lovingiz qabul qilindi, lekin ${label} hozir avtomatik yuborilmadi.\n\nYordam: ${SUPPORT_TELEGRAM_MENTION}\n\nBuyurtma #${orderId}`;
}
