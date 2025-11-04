#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

import { bls12_381 } from "@noble/curves/bls12-381.js";
import { hexToBytes, bytesToHex } from "@noble/curves/abstract/utils.js";

const DRAND_QUICKNET_CHAIN_HASH =
  "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const DRAND_QUICKNET_PUBLIC_KEY =
  "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";

async function fetchLatestDrand() {
  const url = `https://api.drand.sh/${DRAND_QUICKNET_CHAIN_HASH}/public/latest`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch drand: ${response.statusText}`);
  }
  return await response.json();
}

function decompressG1Point(compressedHex: string): string {
  // Remove 0x prefix if present
  const hex = compressedHex.startsWith("0x")
    ? compressedHex.slice(2)
    : compressedHex;

  // Parse compressed G1 point (48 bytes)
  const compressed = hexToBytes(hex);
  if (compressed.length !== 48) {
    throw new Error(
      `Expected 48 bytes for compressed G1, got ${compressed.length}`,
    );
  }

  // Decompress using noble/curves
  const point = bls12_381.G1.Point.fromHex(hex);
  const affine = point.toAffine();

  // Convert field elements to 48-byte big-endian arrays
  const xBytes = affine.x.toBytes();
  const yBytes = affine.y.toBytes();

  // Concatenate x || y for uncompressed format (96 bytes)
  const uncompressed = new Uint8Array(96);
  uncompressed.set(xBytes, 0);
  uncompressed.set(yBytes, 48);

  return bytesToHex(uncompressed);
}

function decompressG2Point(compressedHex: string): string {
  // Remove 0x prefix if present
  const hex = compressedHex.startsWith("0x")
    ? compressedHex.slice(2)
    : compressedHex;

  // Parse compressed G2 point (96 bytes)
  const compressed = hexToBytes(hex);
  if (compressed.length !== 96) {
    throw new Error(
      `Expected 96 bytes for compressed G2, got ${compressed.length}`,
    );
  }

  // Decompress using noble/curves
  const point = bls12_381.G2.Point.fromHex(hex);
  const affine = point.toAffine();

  // For G2, coordinates are Fp2 elements (c0 + c1 * u)
  // Extract 48-byte arrays for each component
  const xc0Bytes = affine.x.c0.toBytes();
  const xc1Bytes = affine.x.c1.toBytes();
  const yc0Bytes = affine.y.c0.toBytes();
  const yc1Bytes = affine.y.c1.toBytes();

  // Concatenate in CAP-0059 order: x_c1 || x_c0 || y_c1 || y_c0 (192 bytes)
  const uncompressed = new Uint8Array(192);
  uncompressed.set(xc1Bytes, 0);
  uncompressed.set(xc0Bytes, 48);
  uncompressed.set(yc1Bytes, 96);
  uncompressed.set(yc0Bytes, 144);

  return bytesToHex(uncompressed);
}

async function main() {
  const command = process.argv[2];

  if (command === "fetch-and-decompress") {
    // Fetch latest drand round and decompress signature
    const drand = await fetchLatestDrand();
    const decompressedSig = decompressG1Point(drand.signature);
    const decompressedPubkey = decompressG2Point(DRAND_QUICKNET_PUBLIC_KEY);

    console.log(
      JSON.stringify({
        round: drand.round,
        signature: decompressedSig,
        publicKey: decompressedPubkey,
      }),
    );
  } else if (command === "decompress-pubkey") {
    // Just decompress the public key
    const decompressed = decompressG2Point(DRAND_QUICKNET_PUBLIC_KEY);
    console.log(decompressed);
  } else {
    console.error("Usage:");
    console.error("  npx tsx decompressDrandPubkey.ts fetch-and-decompress");
    console.error("  npx tsx decompressDrandPubkey.ts decompress-pubkey");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
