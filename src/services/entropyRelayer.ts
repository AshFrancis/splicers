/**
 * Drand Entropy Relayer for Gene Splicer Contract
 *
 * Architecture:
 * - Relayer: Fetches drand entropy, parses compressed BLS12-381 points (NON-SECURITY-CRITICAL)
 * - Contract: Performs H2C and pairing verification (SECURITY-CRITICAL)
 *
 * This service fetches drand quicknet entropy and decompresses BLS12-381 points
 * to affine coordinates that can be verified on-chain by the Soroban contract.
 */

import { bls12_381 } from "@noble/curves/bls12-381.js";

/**
 * Drand quicknet configuration
 * - Chain hash: 52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971
 * - Public key: 83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a
 * - Period: 3 seconds
 * - Genesis: 1692803367
 */
const DRAND_QUICKNET_URL =
  "https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971";
const DRAND_QUICKNET_PUBLIC_KEY_HEX =
  "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a";

export interface DrandRound {
  round: number;
  randomness: string; // hex string
  signature: string; // hex string (compressed G1, 48 bytes)
}

export interface UncompressedEntropy {
  round: number;
  randomness: Uint8Array; // 32 bytes (SHA-256)
  signature_uncompressed: Uint8Array; // 96 bytes (G1 affine: x || y)
}

/**
 * Decompress BLS12-381 G1 point from compressed format (48 bytes) to uncompressed affine coordinates (96 bytes)
 *
 * @param compressed - Compressed G1 point (48 bytes)
 * @returns Uncompressed affine coordinates: x (48 bytes) || y (48 bytes)
 */
export function decompressG1Point(compressed: Uint8Array): Uint8Array {
  if (compressed.length !== 48) {
    throw new Error(
      `Invalid G1 compressed point length: ${compressed.length}, expected 48`,
    );
  }

  // Use noble-curves to decompress the G1 point
  // Convert Uint8Array to hex string for fromHex
  const compressedHex = bytesToHex(compressed);
  const point = bls12_381.G1.Point.fromHex(compressedHex);

  // Convert to affine coordinates
  const affine = point.toAffine();

  // Serialize to uncompressed format: x || y (each 48 bytes, big-endian)
  const x = affine.x;
  const y = affine.y;

  // Convert field elements to 48-byte big-endian arrays
  const xBytes = fieldElementToBytes(x);
  const yBytes = fieldElementToBytes(y);

  // Concatenate x || y
  const uncompressed = new Uint8Array(96);
  uncompressed.set(xBytes, 0);
  uncompressed.set(yBytes, 48);

  return uncompressed;
}

/**
 * Decompress BLS12-381 G2 point from compressed format (96 bytes) to uncompressed affine coordinates (192 bytes)
 *
 * @param compressed - Compressed G2 point (96 bytes)
 * @returns Uncompressed affine coordinates in CAP-0059 byte order: x_c1 || x_c0 || y_c1 || y_c0 (each 48 bytes)
 */
export function decompressG2Point(compressed: Uint8Array): Uint8Array {
  if (compressed.length !== 96) {
    throw new Error(
      `Invalid G2 compressed point length: ${compressed.length}, expected 96`,
    );
  }

  // Use noble-curves to decompress the G2 point
  // Convert Uint8Array to hex string for fromHex
  const compressedHex = bytesToHex(compressed);
  const point = bls12_381.G2.Point.fromHex(compressedHex);

  // Convert to affine coordinates
  const affine = point.toAffine();

  // Serialize to uncompressed format: x_c1 || x_c0 || y_c1 || y_c0
  // G2 points are on Fp2, so x and y each have two components (c0, c1)
  // NOTE: Soroban expects CAP-0059 byte order (c1-first, same as IETF standard)
  const x = affine.x;
  const y = affine.y;

  // Extract components and convert to bytes
  const xc0Bytes = fieldElementToBytes(x.c0);
  const xc1Bytes = fieldElementToBytes(x.c1);
  const yc0Bytes = fieldElementToBytes(y.c0);
  const yc1Bytes = fieldElementToBytes(y.c1);

  // Concatenate x_c1 || x_c0 || y_c1 || y_c0 (CAP-0059 byte order)
  const uncompressed = new Uint8Array(192);
  uncompressed.set(xc1Bytes, 0);
  uncompressed.set(xc0Bytes, 48);
  uncompressed.set(yc1Bytes, 96);
  uncompressed.set(yc0Bytes, 144);

  return uncompressed;
}

/**
 * Convert a field element to a 48-byte big-endian array
 */
function fieldElementToBytes(element: bigint): Uint8Array {
  const hex = element.toString(16).padStart(96, "0"); // 48 bytes = 96 hex chars
  const bytes = new Uint8Array(48);
  for (let i = 0; i < 48; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

interface DrandApiResponse {
  round: number;
  randomness: string;
  signature: string;
}

/**
 * Fetch latest drand entropy from quicknet
 */
export async function fetchLatestDrandEntropy(): Promise<DrandRound> {
  const response = await fetch(`${DRAND_QUICKNET_URL}/public/latest`);
  if (!response.ok) {
    throw new Error(`Failed to fetch drand entropy: ${response.statusText}`);
  }

  const data = (await response.json()) as DrandApiResponse;
  return {
    round: data.round,
    randomness: data.randomness,
    signature: data.signature,
  };
}

/**
 * Fetch drand entropy for a specific round
 */
export async function fetchDrandEntropy(round: number): Promise<DrandRound> {
  const response = await fetch(`${DRAND_QUICKNET_URL}/public/${round}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch drand entropy for round ${round}: ${response.statusText}`,
    );
  }

  const data = (await response.json()) as DrandApiResponse;
  return {
    round: data.round,
    randomness: data.randomness,
    signature: data.signature,
  };
}

/**
 * Parse and decompress drand entropy for contract submission
 *
 * This function performs the NON-SECURITY-CRITICAL parsing:
 * - Converts hex strings to bytes
 * - Decompresses BLS12-381 G1 signature from 48 to 96 bytes
 *
 * The contract will perform SECURITY-CRITICAL operations:
 * - Message construction from previous signature + round
 * - Hash-to-curve (H2C) using hash_to_g1
 * - Pairing verification using pairing_check
 */
export function parseAndDecompressEntropy(
  drandRound: DrandRound,
): UncompressedEntropy {
  // Convert randomness from hex to bytes (32 bytes SHA-256 hash)
  const randomness = hexToBytes(drandRound.randomness);
  if (randomness.length !== 32) {
    throw new Error(
      `Invalid randomness length: ${randomness.length}, expected 32`,
    );
  }

  // Convert signature from hex to bytes (48 bytes compressed G1)
  const signatureCompressed = hexToBytes(drandRound.signature);
  if (signatureCompressed.length !== 48) {
    throw new Error(
      `Invalid signature length: ${signatureCompressed.length}, expected 48`,
    );
  }

  // Decompress G1 signature to affine coordinates (96 bytes: x || y)
  const signatureUncompressed = decompressG1Point(signatureCompressed);

  return {
    round: drandRound.round,
    randomness,
    signature_uncompressed: signatureUncompressed,
  };
}

/**
 * Get the uncompressed drand quicknet public key
 * This needs to be passed to the contract during initialization
 */
export function getUncompressedPublicKey(): Uint8Array {
  const compressed = hexToBytes(DRAND_QUICKNET_PUBLIC_KEY_HEX);
  return decompressG2Point(compressed);
}

/**
 * Helper: Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove '0x' prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Helper: Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
