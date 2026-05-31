import {
  checkPremiumRecipientEligibility,
  sendPremiumEligibilityFailure,
} from "./eligibility.js";

/** POST body: { username, months } */
export async function handlePremiumRecipientSearch(req, res, { pool }) {
  try {
    const { username, months } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username kerak" });
    }

    const check = await checkPremiumRecipientEligibility(pool, username, months);
    if (!check.ok) {
      return sendPremiumEligibilityFailure(res, check);
    }

    return res.json(check.profile);
  } catch (err) {
    console.error("❌ premium recipient search:", err.message);
    return res.status(500).json({ error: "Qidiruvda xato" });
  }
}
