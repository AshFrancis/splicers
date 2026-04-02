#!/bin/bash
# Keep-alive script for the Gene Splicer contract on Soroban testnet.
# Extends the TTL for the contract instance and WASM code to prevent expiration.
#
# Usage:
#   bash scripts/keepAlive.sh [source-identity]
#
# The source identity defaults to "splicers-server" (the funded server wallet).
# The contract's extend_ttl() sets TTL to ~30 days (432,000 ledgers).

set -euo pipefail

CONTRACT_ID=$(grep PUBLIC_GENE_SPLICER_CONTRACT_ID .env | cut -d= -f2)
NETWORK="testnet"
SOURCE="${1:-splicers-server}"

if [ -z "$CONTRACT_ID" ]; then
  echo "ERROR: CONTRACT_ID not found in .env"
  exit 1
fi

echo "Extending TTL for contract: $CONTRACT_ID (source: $SOURCE)"

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  --source "$SOURCE" \
  --send=yes \
  -- extend_ttl

echo "TTL extended successfully"
