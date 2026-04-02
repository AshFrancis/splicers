#!/bin/bash
# Keep-alive script for the Gene Splicer contract on Soroban testnet
# Extends the TTL for the contract instance and WASM code to prevent expiration.
#
# Usage:
#   bash scripts/keepAlive.sh
#
# Recommended: Run weekly via cron or GitHub Actions scheduled workflow.
# Soroban testnet minimum persistent TTL is ~24 hours (4096 ledgers).
# The contract's extend_ttl() sets TTL to ~30 days (432,000 ledgers).

set -euo pipefail

# Load contract ID from .env
CONTRACT_ID=$(grep PUBLIC_GENE_SPLICER_CONTRACT_ID .env | cut -d= -f2)
NETWORK="testnet"
SOURCE="testnet-user"

if [ -z "$CONTRACT_ID" ]; then
  echo "ERROR: CONTRACT_ID not found in .env"
  exit 1
fi

echo "Extending TTL for contract: $CONTRACT_ID"

# Call the contract's extend_ttl() function
# This extends both instance storage and WASM code TTL
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network "$NETWORK" \
  --source "$SOURCE" \
  --send=yes \
  -- extend_ttl

echo "TTL extended successfully"
