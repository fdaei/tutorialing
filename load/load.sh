#!/usr/bin/env bash
# load.js equivalent — expected peak traffic against public read endpoints.
# Usage: load/load.sh [base_url]
set -euo pipefail
source "$(dirname "$0")/config.sh"
BASE="$(load_base_url "${1:-}")"
echo "== load: 20 connections, 30s, GET /teachers =="
npx -y autocannon -c 20 -d 30 -m GET "$BASE/teachers"
echo
echo "== load: 20 connections, 30s, GET /languages =="
npx -y autocannon -c 20 -d 30 -m GET "$BASE/languages"
