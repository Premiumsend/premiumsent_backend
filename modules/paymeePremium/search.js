import {
  checkPaymeePremiumRecipientEligibility,
  sendPremiumEligibilityFailure,
} from "../premium/eligibility.js";

/**
 * POST /api/paymee-premium/search
 * StarsPaymee Partner API (POST /v1/search) orqali premium qabul qiluvchini tekshiradi.
 */
export async function paymeePremiumSearch(req, res, { pool }) {
  try {
    const { username, months } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username kerak" });
    }

    const check = await checkPaymeePremiumRecipientEligibility(pool, username, months);
    if (!check.ok) {
      return sendPremiumEligibilityFailure(res, check);
    }

    return res.json(check.profile);
  } catch (err) {
    console.error("❌ paymee premium search:", err.message);
    return res.status(500).json({ error: "Qidiruvda xato" });
  }
}
