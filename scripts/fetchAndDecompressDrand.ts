#!/usr/bin/env tsx
/**
 * Fetch drand entropy and decompress for contract submission
 * Outputs JSON with round, randomness (hex), and signature (hex)
 *
 * Usage:
 *   npx tsx scripts/fetchAndDecompressDrand.ts          # Fetch latest round
 *   npx tsx scripts/fetchAndDecompressDrand.ts 5558089  # Fetch specific round
 */

import {
  fetchLatestDrandEntropy,
  fetchDrandEntropy,
  parseAndDecompressEntropy,
  bytesToHex,
} from "../src/services/entropyRelayer.js";

async function main() {
  try {
    // Fetch drand entropy (latest or specific round)
    const roundArg = process.argv[2];
    const drandRound = roundArg
      ? await fetchDrandEntropy(parseInt(roundArg))
      : await fetchLatestDrandEntropy();

    // Decompress signature
    const uncompressed = parseAndDecompressEntropy(drandRound);

    // Output as JSON
    const result = {
      round: uncompressed.round,
      randomness: bytesToHex(uncompressed.randomness),
      signature: bytesToHex(uncompressed.signature_uncompressed),
    };

    console.log(JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

void main();
