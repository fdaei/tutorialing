#!/usr/bin/env bash
# load.js equivalent — expected peak traffic against public read endpoints.
# Usage: load/load.sh [base_url]
set -euo pipefail
BASE="${1:-http://localhost:4001/api}"
echo "== load: 20 connections, 30s, GET /teachers =="
npx -y autocannon -c 20 -d 30 -m GET "$BASE/teachers"
echo
echo "== load: 20 connections, 30s, GET /languages =="
npx -y autocannon -c 20 -d 30 -m GET "$BASE/languages"
