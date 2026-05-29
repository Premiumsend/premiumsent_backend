#!/bin/bash
# Ubuntu VPS: PEP 668 — venv orqali Fragment kutubxonalari
set -e
cd "$(dirname "$0")/.."

if ! python3 -m venv --help >/dev/null 2>&1; then
  echo "python3-venv o'rnatilmoqda..."
  sudo apt-get update -qq
  sudo apt-get install -y python3-venv python3-full
fi

node scripts/setup-python-venv.mjs
