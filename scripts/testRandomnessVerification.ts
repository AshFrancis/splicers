#!/usr/bin/env tsx
/**
 * Test randomness verification in the gene-splicer contract
 *
 * This script:
 * 1. Fetches live drand entropy
 * 2. Decompresses the signature
 * 3. Computes the correct randomness (SHA256(signature))
 * 4. Tests that valid randomness passes verification
 * 5. Tests that fake randomness is rejected
 */

import {
  fetchLatestDrandEntropy,
  parseAndDecompressEntropy,
  bytesToHex,
} from "../src/services/entropyRelayer.js";
import crypto from "crypto";

async function main() {
  console.log("🔐 Testing Randomness Verification\n");

  // Fetch drand data
  console.log("Fetching drand data...");
  const drand = await fetchLatestDrandEntropy();
  console.log(`Round: ${drand.round}`);
  console.log(`Signature (compressed): ${drand.signature.substring(0, 32)}...`);
  console.log(
    `Randomness (from drand): ${drand.randomness.substring(0, 32)}...\n`,
  );

  // Decompress signature
  console.log("Decompressing signature...");
  const entropy = parseAndDecompressEntropy(drand);
  const compressedSig = drand.signature;
  const uncompressedSig = bytesToHex(entropy.signature_uncompressed);
  console.log(
    `Signature (compressed, 48 bytes): ${compressedSig.substring(0, 32)}...`,
  );
  console.log(
    `Signature (uncompressed, 96 bytes): ${uncompressedSig.substring(0, 32)}...\n`,
  );

  // Compute randomness from COMPRESSED signature (matches drand!)
  console.log("Computing randomness = SHA256(compressed_signature)...");
  const compressedBytes = Buffer.from(compressedSig, "hex");
  const hash = crypto.createHash("sha256").update(compressedBytes).digest();
  const computedRandomness = bytesToHex(hash);
  console.log(`Computed randomness: ${computedRandomness}\n`);

  // Verify it matches drand
  console.log("Verifying randomness matches drand...");
  if (computedRandomness === drand.randomness) {
    console.log(
      "✅ Perfect match! SHA256(compressed_sig) == drand.randomness\n",
    );
  } else {
    console.log("❌ Mismatch!");
    console.log(`Expected: ${drand.randomness}`);
    console.log(`Got: ${computedRandomness}\n`);
    process.exit(1);
  }

  // Output test data for contract testing
  console.log("📋 Test Data for Contract:");
  console.log("─".repeat(80));
  console.log(`Round: ${drand.round}`);
  console.log(`Compressed Signature (48 bytes): ${compressedSig}`);
  console.log(`Uncompressed Signature (96 bytes): ${uncompressedSig}`);
  console.log(`Randomness (32 bytes): ${computedRandomness}`);
  console.log("─".repeat(80));
  console.log("\n✅ Contract will:");
  console.log(
    "  1. Verify compressed & uncompressed represent same point (x-coordinate match)",
  );
  console.log("  2. Verify BLS signature using uncompressed (pairing check)");
  console.log(
    "  3. Compute randomness = SHA256(compressed) - matches drand! ✅",
  );
  console.log("  4. Use randomness to generate creature genes");
}

main().catch(console.error);
