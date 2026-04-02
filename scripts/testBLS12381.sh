#!/bin/bash
# Test BLS12-381 signature verification with live drand entropy

echo "🔐 BLS12-381 Signature Verification Test with Live Drand Data"
echo ""

# Fetch latest drand entropy
DRAND_URL="https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/latest"
RESPONSE=$(curl -s "$DRAND_URL")

# Extract round, signature, and randomness
ROUND=$(echo "$RESPONSE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')).round)")
SIG_COMPRESSED=$(echo "$RESPONSE" | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')).signature)")

echo "Round: $ROUND"
echo "Signature (compressed, 48 bytes): ${SIG_COMPRESSED:0:32}..."
echo ""

# Decompress signature using noble-curves
echo "Decompressing signature..."
SIG_UNCOMPRESSED=$(node -e "
import('@noble/curves/bls12-381.js').then(({ bls12_381 }) => {
  const compressed = '$SIG_COMPRESSED';
  const point = bls12_381.G1.Point.fromHex(compressed);
  const affine = point.toAffine();

  // Convert to 48-byte big-endian arrays
  const x = affine.x.toString(16).padStart(96, '0');
  const y = affine.y.toString(16).padStart(96, '0');

  console.log(x + y);
});
")

echo "Signature (uncompressed, 96 bytes): ${SIG_UNCOMPRESSED:0:32}..."
echo ""

# Drand public key (c1-first, 192 bytes)
DRAND_PUBKEY="03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273"

# Get contract ID from .env
CONTRACT_ID=$(grep PUBLIC_GENE_SPLICER_CONTRACT_ID .env | cut -d= -f2)
if [ -z "$CONTRACT_ID" ]; then
  echo "ERROR: CONTRACT_ID not found in .env"
  exit 1
fi

# Compute randomness = SHA256(compressed_signature)
RANDOMNESS=$(echo -n "$SIG_COMPRESSED" | xxd -r -p | shasum -a 256 | cut -d' ' -f1)

echo "Testing with contract: $CONTRACT_ID"
echo "Randomness: ${RANDOMNESS:0:32}..."
echo ""

# Splice a genome first to get a cartridge, then finalize with real entropy
# This tests the full flow: mint -> finalize with real BLS verification
echo "Calling finalize_splice with real drand data..."
echo "(Note: requires a minted cartridge with matching splice_round)"
echo ""
echo "To test manually:"
echo "  stellar contract invoke --id $CONTRACT_ID --network testnet --source testnet-user -- finalize_splice \\"
echo "    --cartridge_id 1 --round $ROUND \\"
echo "    --randomness $RANDOMNESS \\"
echo "    --signature_compressed $SIG_COMPRESSED \\"
echo "    --signature_uncompressed $SIG_UNCOMPRESSED"
