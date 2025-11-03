#!/bin/bash
# Submit entropy for a specific drand round
# Usage: bash scripts/submitEntropyForRound.sh <round_number>

set -e

if [ -z "$1" ]; then
  echo "Usage: bash scripts/submitEntropyForRound.sh <round_number>"
  exit 1
fi

ROUND_NUMBER=$1

echo "🎲 Fetching entropy for round $ROUND_NUMBER..."
ENTROPY_DATA=$(npx tsx scripts/fetchAndDecompressDrand.ts "$ROUND_NUMBER")

ROUND=$(echo "$ENTROPY_DATA" | jq -r '.round')
RANDOMNESS=$(echo "$ENTROPY_DATA" | jq -r '.randomness')
SIGNATURE=$(echo "$ENTROPY_DATA" | jq -r '.signature')

echo "   Round: $ROUND"
echo "   Randomness: ${RANDOMNESS:0:32}..."
echo "   Signature (96 bytes): ${SIGNATURE:0:32}..."
echo ""

# Step 2: Submit to contract
echo "📤 Submitting entropy to contract..."

CONTRACT_ID="CCUXEQHSH447LROB3Z27POXMIU3WWNAAAMDD5U25ZBJ3W62IRLKDWU3M"
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
  echo "✅ SUCCESS: Entropy for round $ROUND submitted!"
  echo ""
  exit 0
else
  echo ""
  echo "❌ FAILED: Entropy submission failed"
  exit 1
fi
