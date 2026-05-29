/** TON Fragment hamyon: SEED (mnemonic) va API_KEY */

export function countMnemonicWords(seed) {
  return String(seed || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @returns {{ ok: true, wordCount: number } | { ok: false, error: string }}
 */
export function validateFragmentWalletEnv() {
  const seed = (process.env.SEED || "").trim();
  const apiKey = (process.env.API_KEY || "").trim();

  if (!seed || !apiKey) {
    return { ok: false, error: "SEED va API_KEY .env da kerak (Fragment hamyon)" };
  }

  const wordCount = countMnemonicWords(seed);
  if (![12, 18, 24].includes(wordCount)) {
    return {
      ok: false,
      error:
        `SEED mnemonic noto'g'ri: ${wordCount} ta so'z (12, 18 yoki 24 kerak). ` +
        `Fragment/Tonkeeper dan to'liq seed frazani bo'shliqsiz nusxalang — ortiqcha yoki yetishmayotgan so'z bo'lmasin.`,
    };
  }

  return { ok: true, wordCount };
}

export function hasWalletEnv() {
  return validateFragmentWalletEnv().ok;
}

/** Admin diagnostika — seed matnini ko'rsatmaydi */
export function walletEnvDiagnostics() {
  const seed = (process.env.SEED || "").trim();
  const apiKey = (process.env.API_KEY || "").trim();
  const wordCount = seed ? countMnemonicWords(seed) : 0;
  const validWords = [12, 18, 24].includes(wordCount);

  return {
    has_seed: Boolean(seed),
    has_api_key: Boolean(apiKey),
    seed_word_count: wordCount,
    seed_words_valid: validWords,
    wallet_ready: Boolean(seed && apiKey && validWords),
  };
}
