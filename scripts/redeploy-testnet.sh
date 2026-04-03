#!/bin/bash
# Full testnet redeployment script
# Run after a testnet reset to restore everything from scratch.
#
# Usage:
#   bash scripts/redeploy-testnet.sh
#
# Prerequisites:
#   - stellar CLI installed
#   - Stellar identity "testnet-user" configured (stellar keys generate testnet-user --network testnet)
#   - SSH access to server at 178.156.244.26

set -euo pipefail

echo "=== Splicers Testnet Redeployment ==="
echo ""

# Step 1: Fund wallets
echo "[1/7] Funding wallets via friendbot..."
TESTNET_USER_ADDR=$(stellar keys address testnet-user)
SPLICERS_SERVER_ADDR=$(stellar keys address splicers-server 2>/dev/null || echo "")

curl -sf "https://friendbot.stellar.org/?addr=$TESTNET_USER_ADDR" > /dev/null
echo "  Funded testnet-user: $TESTNET_USER_ADDR"

if [ -n "$SPLICERS_SERVER_ADDR" ]; then
  curl -sf "https://friendbot.stellar.org/?addr=$SPLICERS_SERVER_ADDR" > /dev/null
  echo "  Funded splicers-server: $SPLICERS_SERVER_ADDR"
fi

# Step 2: Build contract
echo ""
echo "[2/7] Building contract..."
stellar contract build
echo "  Build complete"

# Step 3: Install WASM
echo ""
echo "[3/7] Installing WASM on testnet..."
WASM_HASH=$(stellar contract install \
  --wasm target/wasm32v1-none/release/gene_splicer.wasm \
  --network testnet \
  --source testnet-user 2>&1 | tail -1)
echo "  WASM hash: $WASM_HASH"

# Step 4: Deploy contract
echo ""
echo "[4/7] Deploying contract..."
DRAND_PUBKEY="03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273"

CONTRACT_ID=$(stellar contract deploy \
  --wasm-hash "$WASM_HASH" \
  --network testnet \
  --source testnet-user \
  -- \
  --admin "$TESTNET_USER_ADDR" \
  --xlm_token CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4 \
  --cartridge_skin_count 10 \
  --dev_mode false \
  --drand_public_key "$DRAND_PUBKEY" 2>&1 | tail -1)
echo "  Contract ID: $CONTRACT_ID"

# Step 5: Update .env
echo ""
echo "[5/7] Updating contract ID..."
sed -i '' "s/^PUBLIC_GENE_SPLICER_CONTRACT_ID=.*/PUBLIC_GENE_SPLICER_CONTRACT_ID=$CONTRACT_ID/" .env
echo "  Updated .env"

# Update GitHub secret
if command -v gh &> /dev/null; then
  gh secret set TESTNET_CONTRACT_ID --body "$CONTRACT_ID" --repo AshFrancis/splicers
  echo "  Updated GitHub secret"
else
  echo "  WARNING: gh CLI not found — manually update TESTNET_CONTRACT_ID GitHub secret"
fi

# Step 6: Rebuild and deploy frontend
echo ""
echo "[6/7] Rebuilding and deploying frontend..."
npm run build > /dev/null 2>&1
rsync -az --delete dist/ root@178.156.244.26:/var/www/splicers/
echo "  Frontend deployed"

# Step 7: Update server and restart
echo ""
echo "[7/7] Updating server..."
ssh root@178.156.244.26 "sed -i 's/^CONTRACT_ID=.*/CONTRACT_ID=$CONTRACT_ID/' /opt/splicers-server/.env && systemctl restart splicers-server"
sleep 2
HEALTH=$(ssh root@178.156.244.26 "curl -sf http://localhost:3001/health" 2>/dev/null || echo "FAILED")
echo "  Server health: $HEALTH"

# Verify
echo ""
echo "=== Redeployment Complete ==="
echo "Contract ID: $CONTRACT_ID"
echo "WASM hash:   $WASM_HASH"
echo ""
echo "Verify: stellar contract invoke --id $CONTRACT_ID --network testnet --source testnet-user -- get_dev_mode"
