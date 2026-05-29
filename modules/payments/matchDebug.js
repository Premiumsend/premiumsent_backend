/**
 * To'lov topilmasa — nima uchun (summ, status, vaqt) logga chiqaradi.
 */
export async function logPaymentMatchDebug(pool, matchAmount, label = "match") {
  try {
    const amt = parseInt(matchAmount, 10);
    const [pending, exact, near] = await Promise.all([
      pool.query(
        `SELECT id, summ, order_type, status, payment_status,
                ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::int AS age_min
         FROM orders
         WHERE status = 'pending' AND payment_status = 'pending'
         ORDER BY id DESC
         LIMIT 8`
      ),
      pool.query(
        `SELECT id, summ, order_type, status, payment_status,
                ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::int AS age_min
         FROM orders
         WHERE summ = $1
         ORDER BY id DESC
         LIMIT 5`,
        [amt]
      ),
      pool.query(
        `SELECT id, summ, order_type, status, payment_status,
                ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60)::int AS age_min
         FROM orders
         WHERE summ BETWEEN $1 - 500 AND $1 + 500
         ORDER BY ABS(summ - $1), id DESC
         LIMIT 8`,
        [amt]
      ),
    ]);

    console.log(`🔎 [${label}] to'lov=${amt} so'm — debug:`);
    if (pending.rows.length) {
      console.log("   📋 Hozir pending:", JSON.stringify(pending.rows));
    } else {
      console.log("   📋 Pending buyurtma yo'q (expired yoki yaratilmagan)");
    }
    if (exact.rows.length) {
      console.log("   💰 summ mos (lekin status/expired?):", JSON.stringify(exact.rows));
    }
    if (near.rows.length) {
      console.log("   ≈ Yaqin summalar:", JSON.stringify(near.rows));
    }
  } catch (err) {
    console.error("🔎 match debug xato:", err.message);
  }
}
