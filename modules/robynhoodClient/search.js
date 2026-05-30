import { robynhoodConfigured, robynRequest } from "./client.js";

/**
 * RobynHood `found.photo` — HTML <img src="..."> yoki to'g'ridan URL.
 */
export function extractRobynPhotoUrl(photoField) {
  if (!photoField) return null;
  const raw = String(photoField).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const match = raw.match(/src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

/**
 * @param {object} data — { ok, found: { name, photo, recipient, myself? } }
 * @param {string} cleanUsername
 */
export function mapRobynSearchToProfile(data, cleanUsername) {
  if (!data?.ok || !data?.found) {
    return null;
  }
  const found = data.found;
  const name = found.name || cleanUsername;
  const recipient =
    found.recipient ||
    found.id ||
    found.user_id ||
    found.uid ||
    found.telegram_id ||
    cleanUsername;
  const imageUrl = extractRobynPhotoUrl(found.photo);

  return {
    username: cleanUsername,
    fullName: name,
    imageUrl,
    recipient,
    myself: Boolean(found.myself),
  };
}

/**
 * POST /api/search — RobynHood (stars | premium | ads)
 */
export async function searchRobynRecipient({
  productType,
  query,
  quantity,
  months,
}) {
  if (!robynhoodConfigured()) {
    const err = new Error("ROB_API_KEY .env da yo'q");
    err.status = 503;
    throw err;
  }

  const clean = String(query || "")
    .trim()
    .replace(/^@/, "");
  if (!clean) {
    const err = new Error("query (username) kerak");
    err.status = 400;
    throw err;
  }

  const body = {
    product_type: productType,
    query: clean,
  };

  if (productType === "stars") {
    const q = Number(quantity);
    body.quantity = String(Number.isFinite(q) && q >= 50 ? q : 50);
  } else if (productType === "premium") {
    const m = Number(months);
    body.months = String([3, 6, 12].includes(m) ? m : 3);
  }

  const data = await robynRequest("POST", "/api/search", { body });
  return { data, cleanUsername: clean };
}
