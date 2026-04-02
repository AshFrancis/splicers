# Testing

## Running Tests

```bash
# Contract tests (Rust)
cargo test

# Frontend tests (TypeScript)
npm test

# BLS12-381 integration test (requires deployed contract + stellar CLI)
bash scripts/testBLS12381.sh
```

## Test Coverage

### Contract Tests (`contracts/gene-splicer/src/test.rs`)

14 tests covering:

- **Minting**: splice_genome, multiple splices, insufficient balance
- **Finalization**: finalize_splice with mock entropy (dev_mode), double finalization, wrong round, nonexistent cartridge
- **Input validation**: wrong randomness length, wrong compressed sig length, wrong uncompressed sig length
- **Admin**: admin getter/setter, config getters
- **TTL**: extend_ttl permissionless call
- **Constructor**: rejects wrong pubkey length

Tests use `dev_mode=true` to skip BLS verification. Full BLS verification is tested via `scripts/testBLS12381.sh` with live drand data against a deployed contract.

### Frontend Tests (`src/services/entropyRelayer.test.ts`)

19 tests covering:

- Hex conversion utilities
- G1 point decompression (48 -> 96 bytes)
- Drand API fetching (with timeout, error handling)

### What's Not Tested

- React components (GenomeSplicer, BattleArena, CreatureRenderer)
- Wallet provider integration
- End-to-end user flows

These are tested manually via the `/debug` route in development.
