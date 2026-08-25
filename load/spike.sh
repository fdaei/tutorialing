#!/usr/bin/env bash
# spike.js equivalent — sudden ~20x jump from a quiet baseline.
# Usage: load/spike.sh [base_url]
set -euo pipefail
source "$(dirname "$0")/config.sh"
BASE="$(load_base_url "${1:-}")"
echo "== baseline: 5 connections, 10s, GET /teachers =="
npx -y autocannon -c 5 -d 10 -m GET "$BASE/teachers"
echo
echo "== spike: 100 connections, 15s, GET /teachers =="
npx -y autocannon -c 100 -d 15 -m GET "$BASE/teachers"
