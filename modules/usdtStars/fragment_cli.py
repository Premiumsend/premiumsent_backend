#!/usr/bin/env python3
"""
Fragment Stars CLI — JSON stdout (Node.js dan chaqiriladi).

Linux server: python3 ishlating (python emas):
  python3 modules/usdtStars/fragment_cli.py --verify-cookies
  npm run fragment:verify
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from fragment_service import buy_stars, buy_premium, verify_fragment_cookies  # noqa: E402


async def _run_stars(recipient: str, amount: int, payment_method: str) -> dict:
    username = recipient.strip().lstrip("@")
    if not username:
        return {"success": False, "error": "recipient username kerak"}
    if amount < 1:
        return {"success": False, "error": "amount >= 1 bo'lishi kerak"}
    return await buy_stars(username, amount, payment_method=payment_method)


async def _run_premium(recipient: str, months: int, payment_method: str) -> dict:
    username = recipient.strip().lstrip("@")
    if not username:
        return {"success": False, "error": "recipient username kerak"}
    if months not in (3, 6, 12):
        return {"success": False, "error": "months: 3, 6 yoki 12 bo'lishi kerak"}
    return await buy_premium(username, months, payment_method=payment_method)


def main() -> int:
    p = argparse.ArgumentParser(description="Fragment Stars buy (JSON)")
    p.add_argument("--recipient", help="Telegram @username")
    p.add_argument("--amount", type=int, help="Stars soni")
    p.add_argument("--premium", action="store_true", help="Premium sotib olish (stars emas)")
    p.add_argument("--months", type=int, help="Premium oylar: 3, 6, 12")
    p.add_argument(
        "--payment-method",
        default=os.getenv("FRAGMENT_PAYMENT_METHOD", "usdt_ton"),
        help="ton | usdt_ton",
    )
    p.add_argument(
        "--verify-cookies",
        action="store_true",
        help="Faqat Fragment cookie/session tekshiruvi (stars sotib olmaydi)",
    )
    args = p.parse_args()

    try:
        if args.verify_cookies:
            from fragment_service import fragment_env_diagnostics  # noqa: E402

            out = asyncio.run(verify_fragment_cookies())
            if not out.get("diagnostics"):
                out["diagnostics"] = fragment_env_diagnostics()
            print(json.dumps(out, ensure_ascii=False, indent=2))
            return 0 if out.get("ok") else 1
        if args.premium:
            if not args.recipient or not args.months:
                print(
                    json.dumps(
                        {"success": False, "error": "--recipient va --months kerak"},
                        ensure_ascii=False,
                    )
                )
                return 1
            out = asyncio.run(
                _run_premium(args.recipient, args.months, args.payment_method)
            )
        else:
            if not args.recipient or not args.amount:
                print(
                    json.dumps(
                        {"success": False, "error": "--recipient va --amount kerak"},
                        ensure_ascii=False,
                    )
                )
                return 1
            out = asyncio.run(_run_stars(args.recipient, args.amount, args.payment_method))
        print(json.dumps(out, ensure_ascii=False))
        return 0 if out.get("success") else 1
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
