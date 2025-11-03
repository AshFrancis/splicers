# Gene Splicing — Soroban NFT Game Specification (v1 + Fee)

## Premise

The surface world is lost. In subterranean bunkers, humanity splices gene segments to print creatures. This project preserves the technical guarantees from v3.1-fee while re-theming to Gene Splicing.

- Genome Cartridge NFT (pending splice)
- Assembled Creature with head_gene, torso_gene, leg_gene
- Drand-verified entropy with forward-only fallback
- Soroban PRNG for cartridge skins (cosmetic)
- 1 XLM fee via SAC to admin
- Permissionless finalize

## Lifecycle
1) splice_genome() → fee transfer, mint cartridge, PRNG skin, splice_round
2) submit_entropy(round, randomness, signature) → CAP-0059 verify, store
3) finalize_splice(id) → pick target or earliest later round; seed; weighted gene selection; persist; emit

## Entropy Verification (CAP-0059)

**Architecture**: The entropy system uses a security-critical split between relayer and contract:

1. **Off-Chain Relayer** (NON-SECURITY-CRITICAL):
   - Fetches drand quicknet entropy (3s rounds)
   - Decompresses BLS12-381 points: G1 (48→96 bytes), G2 (96→192 bytes)
   - Uses @noble/curves for parsing only
   - Cannot forge valid signatures

2. **On-Chain Contract** (SECURITY-CRITICAL):
   - Deserializes G1Affine/G2Affine using `from_bytes()`
   - Verifies all points in correct subgroups
   - Constructs drand message: `prev_signature || round_bytes`
   - Performs Hash-to-Curve (H2C) with DST: `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`
   - Verifies pairing: `e(signature, G2_gen) == e(hashed_message, drand_pubkey)`
   - All cryptographic verification happens on-chain (immutable)

**Security**: Relayer only provides byte arrays. Contract re-verifies all cryptographic properties, performs H2C itself, and validates pairing equation that requires drand's private key.

**Testing**: `bash scripts/testBLS12381.sh` runs end-to-end verification with live drand data.
