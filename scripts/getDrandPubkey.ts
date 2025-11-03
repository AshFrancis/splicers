#!/usr/bin/env tsx
/**
 * Script to get uncompressed drand public key for contract initialization
 */
import { getUncompressedPublicKey, bytesToHex } from '../src/services/entropyRelayer.js';

const uncompressedPubkey = getUncompressedPublicKey();
const hexPubkey = bytesToHex(uncompressedPubkey);

console.log('Uncompressed drand public key (192 bytes):');
console.log(hexPubkey);
console.log(`\nLength: ${uncompressedPubkey.length} bytes`);
