import { getCachedSettings, loadSettings, setUserbotAutoRefill } from "../settings/settingsDb.js";
import { fetchUserbotStarsBalance } from "./balance.js";
import { getUserbotRefillPublicConfig } from "./service.js";
import { listRefills } from "./db.js";
import { buildRefillSuccessMessage, notifyUserbotRefillChannel } from "./notify.js";

export function registerUserbotStarRefillRoutes(app, ctx) {
  const { pool, adminAuth, bot, botToken, logChannelId } = ctx;
  const channelCtx = { bot, botToken, logChannelId };

  app.get("/api/admin/userbot-refill/status", adminAuth, async (_req, res) => {
    try {
      const settings = await loadSettings(pool, true);
      const balance = await fetchUserbotStarsBalance();
      const cfg = getUserbotRefillPublicConfig();

      res.json({
        success: true,
        enabled: Boolean(settings.userbot_auto_refill_enabled),
        bot_stars_balance: balance,
        ...cfg,
      });
    } catch (err) {
      console.error("❌ GET userbot-refill/status:", err.message);
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  app.post("/api/admin/userbot-refill/toggle", adminAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled (true/false) kerak" });
      }
      await setUserbotAutoRefill(pool, enabled);
      const balance = await fetchUserbotStarsBalance();
      res.json({
        success: true,
        enabled,
        bot_stars_balance: balance,
        ...getUserbotRefillPublicConfig(),
      });
    } catch (err) {
      console.error("❌ POST userbot-refill/toggle:", err.message);
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  app.get("/api/admin/userbot-refill/history", adminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const rows = await listRefills(pool, limit);
      res.json({ success: true, refills: rows });
    } catch (err) {
      res.status(500).json({ error: "Server xatosi" });
    }
  });

  /** Kanalga test xabar — ERROR_LOG_CHANNEL_ID + BOT_TOKEN */
  app.post("/api/admin/userbot-refill/test-channel", adminAuth, async (_req, res) => {
    try {
      const cfg = getUserbotRefillPublicConfig();
      const balance = await fetchUserbotStarsBalance();
      const msg = buildRefillSuccessMessage({
        balanceBefore: balance ?? 0,
        minBalance: cfg.min_balance,
        refillStars: cfg.refill_stars,
        recipient: cfg.refill_username,
        txId: "TEST-" + Date.now(),
        balanceAfter: balance,
      });
      const sent = await notifyUserbotRefillChannel(channelCtx, msg);
      res.json({
        success: sent.ok,
        channel_id: logChannelId,
        error: sent.error || null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log(
    "✅ userbotStarRefill: status, toggle, history, test-channel"
  );
}
