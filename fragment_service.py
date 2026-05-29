"""
fragment_service.py — pyfragment orqali Stars sotib olish.

.env: SEED, API_KEY, DATABASE_URL
Fragment cookie: PostgreSQL `tokens` jadvali (fragment_dt, fragment_ssid, fragment_token, fragment_ton_token)
"""
from __future__ import annotations

import asyncio
import logging
import os
import platform
import socket
import urllib.error
import urllib.request

from dotenv import load_dotenv

_ROOT = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_ROOT, ".env"), encoding="utf-8")

log = logging.getLogger("fragment_service")

_FRAGMENT_DB_KEYS = (
    "fragment_dt",
    "fragment_ssid",
    "fragment_token",
    "fragment_ton_token",
)


def _tokens_from_process_env() -> dict[str, str] | None:
    """Node.js subprocess FRAGMENT_* env uzatganda (psycopg2 shart emas)."""
    ssid = (os.getenv("FRAGMENT_SSID") or "").strip()
    token = (os.getenv("FRAGMENT_TOKEN") or "").strip()
    if not ssid or not token:
        return None
    return {
        "fragment_dt": (os.getenv("FRAGMENT_DT") or "-300").strip(),
        "fragment_ssid": ssid,
        "fragment_token": token,
        "fragment_ton_token": (os.getenv("FRAGMENT_TON_TOKEN") or "").strip(),
    }


def _load_tokens_from_db() -> dict[str, str]:
    injected = _tokens_from_process_env()
    if injected is not None:
        return injected

    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL .env da topilmadi yoki FRAGMENT_SSID/TOKEN env uzatilmagan"
        )

    try:
        import psycopg2  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "psycopg2 o'rnatilmagan: pip3 install psycopg2-binary "
            "(yoki tokenlarni Node orqali FRAGMENT_* env bilan uzating)"
        ) from e

    out: dict[str, str] = {
        "fragment_dt": "-300",
        "fragment_ssid": "",
        "fragment_token": "",
        "fragment_ton_token": "",
    }
    conn = psycopg2.connect(url)
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT key, value FROM tokens WHERE key = ANY(%s)",
                (list(_FRAGMENT_DB_KEYS),),
            )
            for key, value in cur.fetchall():
                if key in out and value is not None:
                    out[key] = str(value).strip()
    finally:
        conn.close()
    return out


def _cookies_from_db() -> dict:
    row = _load_tokens_from_db()
    dt = row.get("fragment_dt") or "-300"
    ssid = row.get("fragment_ssid") or ""
    token = row.get("fragment_token") or ""
    ton_tok = row.get("fragment_ton_token") or ""

    if not ssid or not token:
        raise RuntimeError(
            "Cookie yo'q: `tokens` jadvalida fragment_ssid va fragment_token to'ldiring."
        )

    cookies = {"stel_dt": dt, "stel_ssid": ssid, "stel_token": token}
    if ton_tok:
        cookies["stel_ton_token"] = ton_tok
    return cookies


def _build_client():
    from pyfragment import FragmentClient  # type: ignore

    seed = os.getenv("SEED", "").strip()
    api_key = os.getenv("API_KEY", "").strip()
    cookies = _cookies_from_db()

    if not seed or not api_key:
        raise RuntimeError("SEED yoki API_KEY .env da topilmadi!")

    return FragmentClient(seed=seed, api_key=api_key, cookies=cookies)


def _normalize_payment(method: str) -> str:
    m = (method or "ton").strip().lower()
    if m in ("usdt", "usd", "usdt-ton", "usdt_ton"):
        return "usdt_ton"
    if m == "ton":
        return "ton"
    return "ton"


async def _purchase_stars(client, recipient: str, amount: int, payment_method: str):
    pm = _normalize_payment(payment_method)
    try:
        return await client.purchase_stars(recipient, amount=amount, payment_method=pm)
    except TypeError:
        return await client.purchase_stars(recipient, amount)


def _mask_secret(val: str, show: int = 4) -> str:
    v = (val or "").strip()
    if not v:
        return "(yo'q)"
    if len(v) <= show * 2:
        return f"len={len(v)}"
    return f"{v[:show]}...{v[-show:]} (len={len(v)})"


def fragment_env_diagnostics() -> dict:
    seed = (os.getenv("SEED") or "").strip()
    api = (os.getenv("API_KEY") or "").strip()
    injected = _tokens_from_process_env()
    if injected is not None:
        source = "process_env_from_node"
        row = injected
    else:
        source = "database_tokens_table"
        try:
            row = _load_tokens_from_db()
        except Exception as e:
            source = f"load_error: {e}"
            row = {}
    dt = row.get("fragment_dt") or "(yo'q)"
    ssid = row.get("fragment_ssid") or ""
    token = row.get("fragment_token") or ""
    ton = row.get("fragment_ton_token") or ""

    return {
        "host": socket.gethostname(),
        "platform": platform.platform(),
        "token_source": source,
        "fragment_dt": dt,
        "fragment_ssid": _mask_secret(ssid),
        "fragment_token": _mask_secret(token),
        "fragment_ton_token": _mask_secret(ton),
        "has_seed": bool(seed),
        "has_api_key": bool(api),
        "has_database_url": bool(os.getenv("DATABASE_URL", "").strip()),
        "fragment_http_proxy": bool((os.getenv("FRAGMENT_HTTP_PROXY") or "").strip()),
    }


def _fragment_urlopen(req: urllib.request.Request, timeout: int = 20):
    from fragment_proxy import fragment_urlopen

    return fragment_urlopen(req, timeout=timeout)


def _ensure_fragment_proxy() -> None:
    from fragment_proxy import apply_fragment_http_proxy

    apply_fragment_http_proxy()


def verify_fragment_cookies_sync() -> dict:
    try:
        _ensure_fragment_proxy()
        cookies = _cookies_from_db()
    except Exception as e:
        return {"ok": False, "error": str(e), "diagnostics": fragment_env_diagnostics()}

    cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())
    req = urllib.request.Request(
        "https://fragment.com/stars/buy",
        headers={
            "Cookie": cookie_header,
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        method="GET",
    )
    try:
        with _fragment_urlopen(req, timeout=20) as resp:
            code = resp.getcode()
            if code == 403:
                return {
                    "ok": False,
                    "status": 403,
                    "error": "Fragment 403: tokens jadvalidagi cookie eskirgan yoki yaroqsiz.",
                    "diagnostics": fragment_env_diagnostics(),
                }
            return {"ok": True, "status": code, "diagnostics": fragment_env_diagnostics()}
    except urllib.error.HTTPError as e:
        if e.code == 403:
            return {
                "ok": False,
                "status": 403,
                "error": "Fragment 403: tokens jadvalidagi cookie eskirgan yoki yaroqsiz.",
                "diagnostics": fragment_env_diagnostics(),
            }
        return {
            "ok": False,
            "status": e.code,
            "error": str(e),
            "diagnostics": fragment_env_diagnostics(),
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "diagnostics": fragment_env_diagnostics()}


async def verify_fragment_cookies() -> dict:
    return await asyncio.to_thread(verify_fragment_cookies_sync)


async def buy_stars(recipient: str, amount: int, payment_method: str = "ton") -> dict:
    try:
        _ensure_fragment_proxy()
        async with _build_client() as client:
            result = await _purchase_stars(client, recipient, amount, payment_method)
        txid = getattr(result, "transaction_id", None) or str(result)
        return {"success": True, "transaction_id": txid}
    except Exception as e:
        log.error("❌ Stars xatolik: %s", e)
        return {"success": False, "error": str(e)}


async def buy_premium(recipient: str, months: int, payment_method: str = "ton") -> dict:
    try:
        _ensure_fragment_proxy()
        async with _build_client() as client:
            pm = _normalize_payment(payment_method)
            try:
                result = await client.purchase_premium(
                    recipient, months=months, payment_method=pm
                )
            except TypeError:
                result = await client.purchase_premium(recipient, months)
        txid = getattr(result, "transaction_id", None) or str(result)
        return {"success": True, "transaction_id": txid}
    except Exception as e:
        log.error("❌ Premium xatolik: %s", e)
        return {"success": False, "error": str(e)}
