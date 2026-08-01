#!/usr/bin/env bash
# stress.js equivalent — ramp connections up to find the knee/breaking point.
# Usage: load/stress.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:4001/api}"
for c in 10 50 100 200; do
  echo "== stress: $c connections, 15s, GET /teachers =="
  npx -y autocannon -c "$c" -d 15 -m GET "$BASE/teachers"
  echo
done
