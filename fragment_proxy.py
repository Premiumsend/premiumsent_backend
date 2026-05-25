"""Fragment uchun HTTP/SOCKS proxy (Tor: socks5://127.0.0.1:9050)."""
from __future__ import annotations

import logging
import os
import socket
import urllib.request
from urllib.parse import urlparse

log = logging.getLogger("fragment_proxy")
_applied = False


def normalize_fragment_proxy_url(proxy: str) -> str:
    p = (proxy or "").strip()
    if p.lower().startswith("socks5://"):
        return "socks5h://" + p[len("socks5://") :]
    return p


def get_fragment_http_proxy() -> str:
    raw = (os.getenv("FRAGMENT_HTTP_PROXY") or "").strip()
    return normalize_fragment_proxy_url(raw) if raw else ""


def _is_socks(proxy: str) -> bool:
    p = proxy.lower()
    return p.startswith(("socks4://", "socks5://", "socks5h://", "socks://"))


def apply_fragment_http_proxy() -> str | None:
    """SOCKS: PySocks socket patch; HTTP: HTTP_PROXY/HTTPS_PROXY env."""
    global _applied
    proxy = get_fragment_http_proxy()
    if not proxy:
        return None
    if _applied:
        return proxy

    proxy = normalize_fragment_proxy_url(proxy)
    if _is_socks(proxy):
        try:
            import socks  # type: ignore  # PySocks
        except ImportError as e:
            raise RuntimeError(
                "SOCKS proxy uchun PySocks kerak: pip3 install PySocks"
            ) from e

        parsed = urlparse(proxy)
        sock_type = socks.SOCKS4 if "socks4" in (parsed.scheme or "").lower() else socks.SOCKS5
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 9050
        socks.set_default_proxy(sock_type, host, port, rdns=True)
        socket.socket = socks.socksocket
        log.info("Fragment SOCKS proxy: %s:%s (rdns=True)", host, port)
    else:
        os.environ.setdefault("HTTP_PROXY", proxy)
        os.environ.setdefault("HTTPS_PROXY", proxy)
        log.info("Fragment HTTP proxy: %s", proxy.split("@")[-1])

    _applied = True
    return proxy


def fragment_urlopen(req: urllib.request.Request, timeout: int = 20):
    proxy = get_fragment_http_proxy()
    if proxy and not _is_socks(proxy):
        apply_fragment_http_proxy()
        opener = urllib.request.build_opener(
            urllib.request.ProxyHandler({"http": proxy, "https": proxy})
        )
        return opener.open(req, timeout=timeout)

    if proxy:
        apply_fragment_http_proxy()
    return urllib.request.urlopen(req, timeout=timeout)
