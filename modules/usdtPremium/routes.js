import { createUsdtPremiumOrder } from "./orderCreate.js";
import { sendPremiumViaFragment } from "./delivery.js";
import { getUsdtPremiumPrice } from "./price.js";

const ORDER_TYPE = "premium_usdt";

export async function matchUsdtPremiumPayment(req, res, ctx) {
  const { pool } = ctx;

  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ error: "amount kerak" });
    }

    const updated = await pool.query(
      `UPDATE orders
       SET payment_status = 'paid',
           status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END
       WHERE id = (
         SELECT id FROM orders 
         WHERE summ = $1 
           AND payment_status = 'pending'
           AND status = 'pending'
           AND order_type = $2
           AND created_at >= NOW() - INTERVAL '15 minutes'
         ORDER BY id DESC 
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [amount, ORDER_TYPE]
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Pending USDT premium payment not found" });
    }

    const order = updated.rows[0];
    console.log(`🎉 USDT Premium to'lov tasdiqlandi: #${order.id} | ${order.summ} so'm`);

    sendPremiumViaFragment(order, ctx).catch((err) => {
      console.error("❌ Fragment premium delivery async error:", err.message);
    });

    res.json({
      id: order.id,
      username: order.recipient_username,
      recipient: order.recipient,
      months: order.type_amount,
      amount: order.summ,
      status: "processing",
      payment_status: "paid",
      order_type: ORDER_TYPE,
    });
  } catch (err) {
    console.error("❌ /api/usdt-premium/match error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export function registerUsdtPremiumRoutes(app, ctx) {
  const { orderLimiter, telegramAuth, internalSecretAuth } = ctx;

  app.get("/api/usdt-premium/price/:months", (req, res) => getUsdtPremiumPrice(req, res, ctx));

  app.post("/api/usdt-premium/order", orderLimiter, telegramAuth, (req, res) =>
    createUsdtPremiumOrder(req, res, ctx)
  );

  app.post("/api/usdt-premium/match", internalSecretAuth, (req, res) =>
    matchUsdtPremiumPayment(req, res, ctx)
  );

  app.get("/api/usdt-premium/transactions/:id", telegramAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await ctx.pool.query(
        "SELECT * FROM orders WHERE id=$1 AND order_type=$2",
        [id, ORDER_TYPE]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: "Order topilmadi" });
      }
      const order = result.rows[0];
      const legacyStatus =
        order.status === "completed" || order.status === "delivered"
          ? "premium_sent"
          : order.status;

      return res.json({
        id: order.id,
        username: order.recipient_username,
        recipient: order.recipient,
        muddat_oy: order.type_amount,
        amount: order.summ,
        status: legacyStatus,
        payment_status: order.payment_status,
        transaction_id: order.transaction_id,
        created_at: order.created_at,
      });
    } catch (err) {
      console.error("❌ /api/usdt-premium/transactions error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  console.log(
    "✅ USDT Premium moduli: /api/usdt-premium/price, /api/usdt-premium/order, /api/usdt-premium/match"
  );
}
