#!/usr/bin/env python3
"""Fragment hamyon + recipient diagnostika (sotib olmaydi)."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from fragment_service import diagnose_fragment, fragment_env_diagnostics  # noqa: E402


async def main() -> int:
    username = sys.argv[1] if len(sys.argv) > 1 else None
    out = {
        "diagnostics": fragment_env_diagnostics(),
        "check": await diagnose_fragment(username),
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if out["check"].get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
