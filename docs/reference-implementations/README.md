# BLS12-381 Drand Verification Reference Implementations

This directory contains reference implementations of drand quicknet signature verification in various languages/platforms.

## Byte Order Comparison

Different platforms use different byte orders for G2 points (Fp² field elements). All are mathematically equivalent, just stored differently in memory.

### G2 Point Structure

A G2 point has coordinates (x, y) where x and y are Fp² elements.
Each Fp² element has two components: c0 and c1 (each 48 bytes).
Total: 192 bytes uncompressed.

### Platform Byte Orders

| Platform               | Byte Order                                                   | Total Bytes | Notes                                 |
| ---------------------- | ------------------------------------------------------------ | ----------- | ------------------------------------- |
| **IETF Compressed**    | x_c1 \|\| x_c0                                               | 96          | Standard compressed format (RFC 9380) |
| **Soroban (Stellar)**  | x_c1 \|\| x_c0 \|\| y_c1 \|\| y_c0                           | 192         | c1-first uncompressed (CAP-0059)      |
| **Solidity (EVM)**     | x_c1 \|\| x_c0 \|\| y_c1 \|\| y_c0                           | 192         | Follows IETF order                    |
| **@noble/curves (JS)** | Labels internally as c0/c1, but matches IETF when compressed | 96/192      | Library-specific                      |

### Drand Quicknet Public Key Examples

**IETF Compressed (96 bytes):**

```
83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a
```

**Soroban Uncompressed (192 bytes, c1-first, CAP-0059):**

```
03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273
```

**Solidity Uncompressed (192 bytes, c1-first):**

```solidity
BLS2.PointG2(
    0x03cf0f2896adee7eb8b5f01fcad39122, 0x12c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d106451,  // x_c1
    0x0d1fec758c921cc22b0e17e63aaf4bcb, 0x5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a,  // x_c0
    0x01a714f2edb74119a2f2b0d5a7c75ba9, 0x02d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b,  // y_c1
    0x0e5db2b6bfbb01c867749cadffca88b3, 0x6c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273   // y_c0
)
```

## Files

### QuicknetRegistry.sol

Solidity implementation using BLS precompile with c1-first byte order (IETF standard).

**Key Features:**

- Uses EVM BLS12-381 precompile
- IETF byte order for G2 points
- Splits 48-byte Fp² components into (16 bytes, 32 bytes) for Solidity uint types
- Proves that different byte orders can work with the same drand data

### Verification Scripts (in /scripts)

**verifyDrandSignatureLocally.ts**

- Standalone JavaScript verification using @noble/curves
- Mirrors Soroban contract verification logic
- Uses c0-first byte order (Soroban format)
- Full step-by-step verification with output

**testBothByteOrders.ts**

- Compares c0-first vs c1-first byte orders
- Proves which order matches stored contract data
- Shows relationship between IETF compressed and uncompressed formats

**testStoredDrandPubkey.ts**

- Verifies stored drand public key can round-trip correctly
- Confirms byte ordering is consistent

## Key Insights

1. **Both byte orders are mathematically valid** - They represent the same G2 point
2. **Consistency is critical** - Decompression must match verification byte order
3. **IETF uses c1-first** - Standard compressed format stores c1 before c0
4. **Soroban uses c1-first (CAP-0059)** - Same as IETF standard, NOT c0-first!
5. **Platform-specific** - Always check documentation for target platform
6. **@noble/curves labels are NOT serialization order** - Labels c0/c1 but outputs c1-first when serialized

## Verification Process (Platform Agnostic)

Regardless of byte order, all implementations follow the same BLS12-381 verification:

1. **Deserialize signature** (G1 point, 96 bytes uncompressed)
2. **Check signature in G1 subgroup**
3. **Construct message** (hash of round number or previous signature + round)
4. **Hash-to-curve** message to G1 using DST: `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`
5. **Check hashed point in G1 subgroup**
6. **Deserialize public key** (G2 point, 192 bytes uncompressed)
7. **Check public key in G2 subgroup**
8. **Pairing verification**: `e(signature, G2_generator) == e(hashed_message, public_key)`

## Testing

```bash
# Soroban contract test (uses c0-first)
bash scripts/testBLS12381.sh

# JavaScript standalone verification (uses c0-first, mirrors Soroban)
npx tsx scripts/verifyDrandSignatureLocally.ts

# Compare byte orders
npx tsx scripts/testBothByteOrders.ts

# Verify stored public key
npx tsx scripts/testStoredDrandPubkey.ts
```

## References

- [RFC 9380 - Hashing to Elliptic Curves](https://www.rfc-editor.org/rfc/rfc9380.html)
- [Stellar CAP-0059 - Randomness](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md)
- [Drand Documentation](https://drand.love/docs)
- [BLS Signatures Spec (IETF)](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-bls-signature)
