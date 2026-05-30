import {
  mapRobynSearchToProfile,
  searchRobynRecipient,
} from "../robynhoodClient/search.js";

/**
 * POST /api/paymee-stars/search — RobynHood profil (rasm + ism), yetkazish Paymee
 */
export async function paymeeStarsSearch(req, res) {
  try {
    const { username, stars } = req.body;
    if (!username) {
      return res.status(400).json({ error: "username kerak" });
    }

    const starsNum = parseInt(stars, 10);
    const quantity = Number.isInteger(starsNum) ? starsNum : 50;

    const { data, cleanUsername } = await searchRobynRecipient({
      productType: "stars",
      query: username,
      quantity,
    });

    const profile = mapRobynSearchToProfile(data, cleanUsername);
    if (!profile) {
      return res.status(404).json({
        error: "Foydalanuvchi topilmadi",
        details: data,
      });
    }

    return res.json(profile);
  } catch (err) {
    console.error("❌ /api/paymee-stars/search:", err.message);
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return res.status(status).json({
      error: err.message || "Qidiruvda xato",
    });
  }
}
