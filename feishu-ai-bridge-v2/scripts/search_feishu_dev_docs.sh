#!/usr/bin/env bash

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"query text\""
  exit 1
fi

QUERY="$1"
USER_KEY="${FEISHU_DOCS_USER_KEY:-7481325171635240962}"
BASE_URL="${FEISHU_DOCS_MCP_URL:-https://project.feishu.cn/mcp_server/knowledge}"
ENDPOINT="${BASE_URL}?userKey=${USER_KEY}"

PAYLOAD=$(printf '%s' "$QUERY" | sed 's/"/\\"/g')

RAW_RESPONSE=$(curl -sS -X POST "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"search_meegle_plugin_docs\",\"arguments\":{\"query\":\"${PAYLOAD}\"}}}")

if command -v jq >/dev/null 2>&1; then
  echo "$RAW_RESPONSE" | jq -r '
    .result.content[]
    | select(.type == "text")
    | .text
  '
else
  echo "$RAW_RESPONSE"
fi
