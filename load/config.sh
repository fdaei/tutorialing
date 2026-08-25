#!/usr/bin/env bash
LOAD_API_URL_DEFAULT="http://localhost:4001/api"
SOAK_SECONDS_DEFAULT="7200"
load_base_url() { printf '%s' "${1:-${LOAD_API_URL:-$LOAD_API_URL_DEFAULT}}"; }
