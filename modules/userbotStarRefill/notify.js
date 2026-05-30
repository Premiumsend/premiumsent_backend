import { escapeTelegramHtml, sendOrdersChannelMessage } from "../telegram/channelNotify.js";

export async function notifyUserbotRefillChannel(ctx, messageHtml) {
  const { bot, botToken, logChannelId } = ctx;
  return sendOrdersChannelMessage({
    text: messageHtml,
    channelId: logChannelId,
    bot,
    botToken,
  });
}

export function buildRefillSuccessMessage({
  balanceBefore,
  minBalance,
  refillStars,
  recipient,
  txId,
  balanceAfter,
}) {
  const safeTx = escapeTelegramHtml(txId);
  const safeRecipient = escapeTelegramHtml(recipient);
  let msg =
    `🤖 <b>Userbot avto-to'ldirish</b>\n\n` +
    `⭐ Userbot balansi <b>${balanceBefore}</b> ⭐ edi (minimum: <b>${minBalance}</b>).\n\n` +
    `✅ Paymee orqali <b>${refillStars}</b> ⭐ yuborildi → @${safeRecipient}\n` +
    `🆔 Tranzaksiya: <code>${safeTx}</code>\n`;
  if (balanceAfter != null) {
    msg += `📊 Hozirgi balans: <b>${balanceAfter}</b> ⭐\n`;
  }
  msg += `\n📌 Sabab: gift buyurtmasi (balans past)`;
  return msg;
}

export function buildRefillErrorMessage({
  balanceBefore,
  minBalance,
  refillStars,
  recipient,
  errMsg,
}) {
  return (
    `⚠️ <b>Userbot avto-to'ldirish XATO</b>\n\n` +
    `⭐ Balans: <b>${balanceBefore}</b> (min: ${minBalance})\n` +
    `👤 Maqsad: @${escapeTelegramHtml(recipient)}, ${refillStars} ⭐\n` +
    `❌ ${escapeTelegramHtml(errMsg)}`
  );
}
