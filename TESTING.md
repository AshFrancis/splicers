# Testing

## Running Tests

```bash
# Contract tests (Rust — 19 tests)
cargo test

# Frontend tests (TypeScript — 33 tests)
npm test

# Server tests (Bun — 15 tests)
cd server && bun test

# BLS12-381 integration test (requires deployed contract + stellar CLI)
bash scripts/testBLS12381.sh
```

## Test Coverage

### Contract Tests (`contracts/gene-splicer/src/test.rs`) — 19 tests

- **Minting**: splice_genome, multiple splices, insufficient balance
- **Finalization**: finalize_splice with mock entropy (dev_mode), double finalization, wrong round, nonexistent cartridge
- **Input validation**: wrong randomness length, wrong compressed sig length, wrong uncompressed sig length
- **Batch queries**: get_cartridges_batch (with missing IDs), get_creatures_batch
- **Admin**: admin getter/setter, config getters, set_skin_count, set_drand_public_key (valid + invalid length)
- **TTL**: extend_ttl permissionless call
- **Constructor**: rejects wrong pubkey length

Tests use `dev_mode=true` to skip BLS verification. Full BLS verification is tested via `scripts/testBLS12381.sh` with live drand data against a deployed contract.

### Frontend Tests — 33 tests across 5 files

- `src/services/entropyRelayer.test.ts` (19 tests) — hex conversion, G1 decompression, drand API fetching with timeouts
- `src/App.test.tsx` (3 tests) — routing, header, debug route availability
- `src/components/ErrorBoundary.test.tsx` (2 tests) — renders children, catches errors
- `src/components/CreatureRenderer.test.tsx` (5 tests) — rendering, walking, attacking, knocked out states
- `src/providers/NotificationProvider.test.tsx` (4 tests) — context provision, notification display, timeout removal

### Server Tests (`server/pinning.test.ts`) — 15 tests

- Gene rarity mapping (Rare, Legendary, Normal for all 15 IDs)
- Gene type mapping (Dark Oracle, Golem, Necromancer, Skeleton Crusader, Skeleton Warrior)
- Input validation (valid input, missing fields, non-integer, negative, out of range, non-object, null)

### What's Not Tested

- GenomeSplicer component (wallet-dependent, would need full wallet mock)
- BattleArena component (complex state machine, tested manually)
- WalletProvider integration (needs real wallet SDK)
- End-to-end user flows across contract + frontend
