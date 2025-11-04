#!/bin/bash

# Test that signatures from one round don't verify for a different round

set -e

echo "=== Testing Wrong Round Number Attack ==="

# Fetch latest drand entropy
DRAND_RESPONSE=$(curl -s "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/latest")

# Extract round and signature
ACTUAL_ROUND=$(echo "$DRAND_RESPONSE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')).round)")
COMPRESSED_SIG=$(echo "$DRAND_RESPONSE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')).signature)")

echo "Fetched round: $ACTUAL_ROUND"
echo "Signature (compressed): ${COMPRESSED_SIG:0:32}..."

# Decompress signature using noble-curves
echo "Decompressing signature..."
SIGNATURE=$(node -e "
import('@noble/curves/bls12-381.js').then(({ bls12_381 }) => {
  const compressed = '$COMPRESSED_SIG';
  const point = bls12_381.G1.Point.fromHex(compressed);
  const affine = point.toAffine();

  // Convert to 48-byte big-endian hex
  const x = affine.x.toString(16).padStart(96, '0');
  const y = affine.y.toString(16).padStart(96, '0');

  console.log(x + y);
});
")

# Drand public key (uncompressed G2, 192 bytes)
PUBKEY="03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273"

echo ""
echo "=== Test 1: Verify with CORRECT round number ==="
CORRECT_RESULT=$(stellar contract invoke \
  --id CB7PGTVTZFYMDXDPFIVIQINM6B5E5PQ545Z5OW4X2A6Z3KLI6SFSLHMT \
  --source me \
  --network local \
  -- \
  test_full_verification \
  --round "$ACTUAL_ROUND" \
  --signature "$SIGNATURE" \
  --drand_public_key "$PUBKEY" 2>&1 | tail -1)

if [[ "$CORRECT_RESULT" == "true" ]]; then
  echo "✅ PASS: Signature verified with correct round $ACTUAL_ROUND"
else
  echo "❌ FAIL: Signature should verify with correct round"
  echo "Result: $CORRECT_RESULT"
  exit 1
fi

echo ""
echo "=== Test 2: Verify with WRONG round number (should FAIL) ==="
WRONG_ROUND=$((ACTUAL_ROUND + 1000))
WRONG_RESULT=$(stellar contract invoke \
  --id CB7PGTVTZFYMDXDPFIVIQINM6B5E5PQ545Z5OW4X2A6Z3KLI6SFSLHMT \
  --source me \
  --network local \
  -- \
  test_full_verification \
  --round "$WRONG_ROUND" \
  --signature "$SIGNATURE" \
  --drand_public_key "$PUBKEY" 2>&1 | tail -1)

if [[ "$WRONG_RESULT" == "false" ]]; then
  echo "✅ PASS: Signature correctly rejected for wrong round $WRONG_ROUND"
elif [[ "$WRONG_RESULT" == "true" ]]; then
  echo ""
  echo "🚨 CRITICAL SECURITY BUG DETECTED! 🚨"
  echo ""
  echo "Signature for round $ACTUAL_ROUND INCORRECTLY verified for round $WRONG_ROUND"
  echo "This means the round number is not properly bound to the signature!"
  echo "An attacker could reuse any valid drand signature for any round number."
  echo ""
  exit 1
else
  echo "❓ UNEXPECTED: Got result: $WRONG_RESULT"
  exit 1
fi

echo ""
echo "=== All tests passed! Verification is working correctly. ==="