import { handlePremiumRecipientSearch } from "../premium/recipientSearch.js";

/**
 * POST /api/paymee-premium/search
 */
export async function paymeePremiumSearch(req, res, { pool }) {
  return handlePremiumRecipientSearch(req, res, { pool });
}
