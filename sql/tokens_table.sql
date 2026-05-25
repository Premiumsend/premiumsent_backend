-- Fragment cookie kalitlari (bir martalik yoki migratsiya)
CREATE TABLE IF NOT EXISTS tokens (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mavjud .env dan to'ldirish (qo'lda qiymatlarni almashtiring):
-- INSERT INTO tokens (key, value) VALUES
--   ('fragment_dt', '-300'),
--   ('fragment_ssid', 'YOUR_SSID'),
--   ('fragment_token', 'YOUR_TOKEN'),
--   ('fragment_ton_token', 'YOUR_TON_TOKEN')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
