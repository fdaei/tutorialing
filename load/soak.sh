#!/usr/bin/env bash
# soak.js equivalent — sustained moderate load to surface leaks/pool exhaustion.
# Default matches the audit spec (2h); override via SOAK_SECONDS for a shorter
# local check (the run captured in AUDIT/05-load.md used a shortened window —
# see that file for why, and what a full 2h run would additionally verify).
# Usage: SOAK_SECONDS=120 load/soak.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:4001/api}"
SECONDS_="${SOAK_SECONDS:-7200}"
echo "== soak: 10 connections, ${SECONDS_}s, GET /teachers =="
npx -y autocannon -c 10 -d "$SECONDS_" -m GET "$BASE/teachers"
