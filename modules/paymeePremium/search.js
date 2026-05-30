import {
  mapRobynSearchToProfile,
  searchRobynRecipient,
} from "../robynhoodClient/search.js";

/**
 * POST /api/paymee-premium/search — RobynHood profil, yetkazish Paymee
 */
export async function paymeePremiumSearch(req, res) {
  try {
    const { username, months } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username kerak" });
    }

    const monthsNum = parseInt(months, 10);
    const m = [3, 6, 12].includes(monthsNum) ? monthsNum : 3;

    const { data, cleanUsername } = await searchRobynRecipient({
      productType: "premium",
      query: username,
      months: m,
    });

    const profile = mapRobynSearchToProfile(data, cleanUsername);
    if (!profile) {
      return res.status(404).json({
        error: "Foydalanuvchi topilmadi yoki Premium mavjud emas",
        details: data,
      });
    }

    return res.json(profile);
  } catch (err) {
    console.error("❌ /api/paymee-premium/search:", err.message);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({
      error: err.message || "Qidiruvda xato",
    });
  }
}
