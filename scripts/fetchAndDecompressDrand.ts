#!/usr/bin/env tsx
/**
 * Fetch latest drand entropy and decompress for contract submission
 * Outputs JSON with round, randomness (hex), and signature (hex)
 */

import {
  fetchLatestDrandEntropy,
  parseAndDecompressEntropy,
  bytesToHex,
} from '../src/services/entropyRelayer.js';

async function main() {
  try {
    // Fetch latest drand entropy
    const drandRound = await fetchLatestDrandEntropy();

    // Decompress signature
    const uncompressed = parseAndDecompressEntropy(drandRound);

    // Output as JSON
    const result = {
      round: uncompressed.round,
      randomness: bytesToHex(uncompressed.randomness),
      signature: bytesToHex(uncompressed.signature_uncompressed),
    };

    console.log(JSON.stringify(result));
  } catch (error: any) {
    console.error(`Error: ${error.message}`, { error });
    process.exit(1);
  }
}

main();
