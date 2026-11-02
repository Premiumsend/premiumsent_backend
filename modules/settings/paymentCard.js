/**
 * To'lov kartalari — ikkita UZCARD slot. Asosiysi `.env` dagi VITE_CARD_*, zaxirasi UZCARD2_CARD_*.
 * Qaysi biri mijozga ko'rsatilishi `settings.payment_card_slot` da, SMS esa ikkalasidan ham qabul qilinadi:
 * karta almashganda eski kartaga to'lagan mijoz yo'qolmasin.
 */

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const SLOTS = {
  uzcard1: {
    number: () => process.env.VITE_CARD_NUMBER,
    name: () => process.env.VITE_CARD_NAME,
  },
  uzcard2: {
    number: () => process.env.UZCARD2_CARD_NUMBER,
    name: () => process.env.UZCARD2_CARD_NAME,
  },
};

const DEFAULT_SLOT = "uzcard1";

function resolveSlot(slot) {
  const def = SLOTS[slot];
  const number = digitsOnly(def.number());
  return {
    slot,
    card_number: number,
    card_name: String(def.name() || "").trim(),
    card_last4: number.slice(-4),
    configured: Boolean(number),
  };
}

// Tanlangan slot; server jarayonida loadSettings yangilaydi
let activeSlot = null;

export function normalizeCardSlot(value) {
  const slot = String(value ?? "").trim().toLowerCase();
  return SLOTS[slot] ? slot : null;
}

export function setActiveCardSlot(value) {
  activeSlot = normalizeCardSlot(value);
}

export function listPaymentCards() {
  return Object.keys(SLOTS).map(resolveSlot);
}

/** SMS qabul qilinadigan kartalar */
export function listMonitoredCards() {
  return listPaymentCards().filter((c) => c.configured);
}

/** Faol karta. Tanlangan slotda raqam bo'lmasa asosiy kartaga tushadi */
export function getPaymentCard() {
  const chosen = activeSlot ? resolveSlot(activeSlot) : null;
  return chosen?.configured ? chosen : resolveSlot(DEFAULT_SLOT);
}
