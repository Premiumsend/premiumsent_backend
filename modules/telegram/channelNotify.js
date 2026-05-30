import fetch from "node-fetch";

export function escapeTelegramHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * ORDERS_CHANNEL ga xabar — Telegraf + Telegram HTTP API fallback.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function sendOrdersChannelMessage({
  text,
  channelId,
  bot = null,
  botToken = null,
  parseMode = "HTML",
}) {
  const chatId = channelId;
  if (chatId == null || chatId === "") {
    console.error("❌ ORDERS_CHANNEL sozlanmagan");
    return { ok: false, error: "ORDERS_CHANNEL yo'q" };
  }

  const token = botToken || process.env.BOT_TOKEN;
  const opts = { parse_mode: parseMode, disable_web_page_preview: true };

  if (bot?.telegram) {
    try {
      await bot.telegram.sendMessage(chatId, text, opts);
      console.log(`✅ Orders channel (${chatId}) ga xabar yuborildi`);
      return { ok: true };
    } catch (err) {
      console.warn(`⚠️ Telegraf sendMessage: ${err.message}, HTTP API sinab ko'rilmoqda...`);
    }
  }

  if (!token) {
    console.error("❌ BOT_TOKEN yo'q — kanalga xabar yuborib bo'lmadi");
    return { ok: false, error: "BOT_TOKEN yo'q" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!data.ok) {
      const desc = data.description || `HTTP ${response.status}`;
      console.error("❌ Telegram sendMessage API:", desc);
      return { ok: false, error: desc };
    }
    console.log(`✅ Orders channel (HTTP API, ${chatId}) ga xabar yuborildi`);
    return { ok: true };
  } catch (err) {
    console.error("❌ Orders channel HTTP API:", err.message);
    return { ok: false, error: err.message };
  }
}
