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
