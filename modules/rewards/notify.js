import { getUserAppLanguage } from "../notifications/orderExpiredMessages.js";

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const at = (u) => (u ? `@${esc(String(u).replace(/^@/, ""))}` : "—");

/* Referal kanali (uch loyiha uchun umumiy): navbat + sekin yuborish. Telegram kanalga ~20 xabar/daqiqa ruxsat beradi,
   to'lsa eng eskisi tashlanadi (bu log, buyurtma jarayoniga ta'sir qilmaydi). */
// Kanalda boshqa loyihalar ham bor: har xabar boshida loyiha nomi turadi
const PROJECT_HEADER = "🟧 <b>PremiumSend</b>\n";
const QUEUE_MAX = 300;
const GAP_MS = 3200;
const queue = [];
let timer = null;

function drain(bot) {
  if (timer || !queue.length) return;
  timer = setTimeout(async () => {
    timer = null;
    const text = queue.shift();
    try {
      await bot.telegram.sendMessage(process.env.REFERRAL_CHANNEL_ID, text, { parse_mode: "HTML", disable_web_page_preview: true });
    } catch (err) {
      console.error("⚠️ Bonus kanal xabari yuborilmadi:", err.message);
    }
    drain(bot);
  }, queue.length > 1 ? GAP_MS : 50);
}

function channelLog(bot, text) {
  if (!bot || !process.env.REFERRAL_CHANNEL_ID) return;
  if (queue.length >= QUEUE_MAX) queue.shift();
  queue.push(PROJECT_HEADER + text);
  drain(bot);
}

const BTN = { uz: "🎁 Bonuslar", ru: "🎁 Бонусы", en: "🎁 Rewards" };
const openApp = (lang) => ({
  reply_markup: { inline_keyboard: [[{ text: BTN[lang] || BTN.uz, web_app: { url: process.env.WEBAPP_URL } }]] },
});

const BUYER_TEXTS = {
  uz: (n, b) => `🎁 Xaridingiz uchun +${n} ⭐ bonus berildi!\n\nBalans: ${b} ⭐`,
  ru: (n, b) => `🎁 За покупку начислено +${n} ⭐ бонуса!\n\nБаланс: ${b} ⭐`,
  en: (n, b) => `🎁 You've earned +${n} ⭐ bonus for your purchase!\n\nBalance: ${b} ⭐`,
};

async function sendToUser({ pool, bot }, userId, build) {
  if (!bot) return;
  try {
    const lang = await getUserAppLanguage(pool, userId).catch(() => "uz");
    await bot.telegram.sendMessage(userId, build(lang), openApp(lang));
  } catch (err) {
    console.error(`⚠️ Bonus xabari yuborilmadi (user=${userId}):`, err.message);
  }
}

/** Xarid bonusi yozilgach: xaridorga. Kanalga bormaydi */
export async function notifyPurchaseBonus(ctx, { userId, points, balance }) {
  await sendToUser(ctx, userId, (lang) => (BUYER_TEXTS[lang] || BUYER_TEXTS.uz)(points, balance));
}

/** Bonus yechildi. /modad zararni shu xabardan yozadi — format o'zgarsa webhook'ni ham yangilang */
export function logRedemption(bot, { owner, recipient, stars, orderId, history = "" }) {
  channelLog(
    bot,
    `🎁 <b>User bonus oldi!</b>\n\n` +
      `👤 Yechdi: ${at(owner)}\n` +
      `📥 Stars oldi: ${at(recipient)}\n` +
      `💫 ${esc(stars)} Stars (bonus balansdan)\n` +
      `📦 Order: #${esc(orderId)}\n` +
      `✅ Status: Yetkazildi` +
      history
  );
}
