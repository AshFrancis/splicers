#!/bin/bash
# Test BLS12-381 verification end-to-end using stellar CLI

set -e

echo "🧪 Testing BLS12-381 Verification Flow"
echo ""

# Step 1: Fetch latest drand entropy and decompress
echo "📡 Step 1: Fetching and decompressing drand entropy..."
ENTROPY_DATA=$(npx tsx scripts/fetchAndDecompressDrand.ts)

ROUND=$(echo "$ENTROPY_DATA" | jq -r '.round')
RANDOMNESS=$(echo "$ENTROPY_DATA" | jq -r '.randomness')
SIGNATURE=$(echo "$ENTROPY_DATA" | jq -r '.signature')

echo "   Round: $ROUND"
echo "   Randomness: ${RANDOMNESS:0:32}..."
echo "   Signature (96 bytes): ${SIGNATURE:0:32}..."
echo ""

# Step 2: Submit to contract
echo "📤 Step 2: Submitting entropy to contract..."
echo "   This will test the full BLS12-381 verification:"
echo "   - G1Affine deserialization from 96 bytes"
echo "   - Subgroup membership checks"
echo "   - On-chain Hash-to-Curve (H2C)"
echo "   - G2Affine deserialization from 192 bytes"
echo "   - Pairing verification: e(sig, G2_gen) == e(H(msg), pubkey)"
echo ""

CONTRACT_ID="CBEWYXNUDGTJIMTTLJKWU6HLERS35YPIW66V4PY6ZFUJELZAVGRKV33X"
SUBMITTER=$(stellar keys address me)

stellar contract invoke \
  --id "$CONTRACT_ID" \
  --network local \
  --source me \
  -- \
  submit_entropy \
  --submitter "$SUBMITTER" \
  --round "$ROUND" \
  --randomness "$RANDOMNESS" \
  --signature "$SIGNATURE"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ SUCCESS: BLS12-381 signature verification passed!"
  echo "   The contract successfully verified:"
  echo "   1. ✓ Deserialized G1Affine signature from 96 bytes"
  echo "   2. ✓ Verified signature is in G1 subgroup"
  echo "   3. ✓ Constructed drand message (prev_sig || round)"
  echo "   4. ✓ Performed on-chain hash-to-curve (H2C)"
  echo "   5. ✓ Verified H2C result is in G1 subgroup"
  echo "   6. ✓ Deserialized G2Affine public key from 192 bytes"
  echo "   7. ✓ Verified public key is in G2 subgroup"
  echo "   8. ✓ Performed pairing check"
  echo "   9. ✓ All cryptographic verification PASSED"
  echo ""
  exit 0
else
  echo ""
  echo "❌ FAILED: BLS12-381 verification failed"
  exit 1
fi
