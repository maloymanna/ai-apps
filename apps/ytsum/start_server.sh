#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
# Save summaries and log inside the extension folder
export YT_SUMMARIES_DIR="$SCRIPT_DIR/yt_summaries"
mkdir -p "$YT_SUMMARIES_DIR"

if [ ! -d "$VENV" ]; then
  echo "[setup] Creating virtual environment…"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip -q
  echo "[setup] Installing dependencies (CPU-only torch, ~800MB first run)…"
  "$VENV/bin/pip" install -r "$SCRIPT_DIR/server/requirements.txt"
  echo "[setup] Done."
fi

echo "[server] Summaries dir: $YT_SUMMARIES_DIR"
echo "[server] Starting on http://127.0.0.1:5000"
"$VENV/bin/python" "$SCRIPT_DIR/server/server.py"
