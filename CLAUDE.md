# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Git Commit Policy

**DO NOT add yourself to git commits.** When creating commits, use simple commit messages without any co-authorship lines or AI attribution. All credit goes to the repository owner. Do not include:

- `Co-Authored-By: Claude <noreply@anthropic.com>`
- Any mention of AI assistance
- Attribution to Claude or Anthropic

## Project Overview

This is a **Gene Splicing NFT Game** built on Stellar's Soroban smart contract platform, using the Scaffold Stellar framework. The game allows players to splice gene segments to create unique creatures as NFTs. See `/docs/specs/gene-splicing-v1.1.md` for the full game specification.

**Tech Stack:**

- **Smart Contracts**: Rust with Soroban SDK (compiled to WASM)
- **Frontend**: Vite + React + TypeScript
- **Deployment**: Static site on GitHub Pages
- **Contract Libraries**: OpenZeppelin Stellar Contracts
- **Blockchain**: Stellar (local dev, testnet, mainnet)

## Development Commands

### Frontend & Contract Development

```bash
# Install dependencies
npm install

# Start dev environment (watches contracts + runs Vite dev server)
npm run dev
# This runs concurrently:
#   - stellar scaffold watch --build-clients (auto-compiles contracts, generates TS clients)
#   - vite (frontend dev server with HMR on http://localhost:5173)

# IMPORTANT: Automatic rebuild doesn't work in most cases
# When making contract changes, you usually need to:
# 1. Kill the dev server (Ctrl+C)
# 2. Remove target directory: rm -rf target
# 3. Restart dev server: npm run dev

# Build production frontend
npm run build

# Preview production build
npm preview

# Lint & format
npm run lint
npm run format

# Rebuild contract clients only
npm install:contracts
```

### Contract Operations

```bash
# Test contracts
cargo test

# Build contracts manually (if not using watch)
stellar contract build

# Install contract to network
stellar contract install --wasm target/wasm32v1-none/release/contract.wasm --network local --source me

# Deploy contract instance
stellar contract deploy --wasm-hash <hash> --network local --source me

# Generate TypeScript bindings
stellar contract bindings typescript --network local --contract-id <id> --output-dir packages/<name> --overwrite

# Direct contract invocation
stellar contract invoke --id <contract-id> --network local --source me -- <method> --arg value

# Initialize gene-splicer with drand public key (192 bytes uncompressed G2)
stellar contract invoke --id <contract-id> --network local --source me -- initialize \
  --admin <address> \
  --xlm_token CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4 \
  --cartridge_skin_count 10 \
  --dev_mode true \
  --drand_public_key <192-byte-hex>

# Get uncompressed drand public key for initialization
npx tsx scripts/getDrandPubkey.ts
```

## Architecture

### Game Contract Lifecycle (Gene Splicing)

1. **splice_genome()**: Player pays 1 XLM fee, receives Genome Cartridge NFT with cosmetic skin (via Soroban PRNG), game stores splice_round (future drand round)
2. **finalize_splice(cartridge_id, round, randomness, sig_compressed, sig_uncompressed)**: User fetches drand entropy client-side, decompresses BLS points, and submits inline. Contract verifies BLS12-381 signature on-chain (CAP-0059), then uses verified entropy to select genes (head, body, legs) and mint Creature NFT

### BLS12-381 Entropy Verification (CAP-0059)

The contract implements full BLS12-381 signature verification using Stellar's CAP-0059 host functions to ensure drand entropy is authentic and cannot be forged.

**Architecture Overview:**

```text
┌─────────────────────┐         ┌──────────────────────────────┐
│  Drand Quicknet     │         │  Client-Side Relayer         │
│  (api.drand.sh)     │────────>│  (NON-SECURITY-CRITICAL)     │
│                     │         │                              │
│  - 48-byte G1 sig   │         │  - Decompress G1: 48→96 bytes│
│  - 32-byte random   │         │  - Decompress G2: 96→192 bytes│
│  - Round number     │         │  - Uses @noble/curves        │
└─────────────────────┘         └──────────────┬───────────────┘
                                               │
                                               │ finalize_splice()
                                               ▼
                                ┌──────────────────────────────┐
                                │  Soroban Contract            │
                                │  (SECURITY-CRITICAL)         │
                                │                              │
                                │  1. G1Affine::from_bytes()   │
                                │  2. g1_is_in_subgroup()      │
                                │  3. Construct drand message  │
                                │  4. hash_to_g1() [H2C]       │
                                │  5. G2Affine::from_bytes()   │
                                │  6. g2_is_in_subgroup()      │
                                │  7. pairing_check()          │
                                │                              │
                                │  ✓ Entropy verified on-chain │
                                └──────────────────────────────┘
```

**Contract Implementation (Rust):**

```rust
use soroban_sdk::{
    Bytes, BytesN, Env,
    crypto::bls12_381::{G1Affine, G2Affine},
};

fn verify_drand_signature(env: &Env, round: u64, signature: &Bytes) {
    // 1. Negate signature for pairing check: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
    let negated_sig = negate_g1_bytes(env, signature);
    let sig_bytes: BytesN<96> = negated_sig.try_into().unwrap();
    let neg_sig_point = G1Affine::from_bytes(sig_bytes);

    // 2. Verify negated signature in G1 subgroup
    if !env.crypto().bls12_381().g1_is_in_subgroup(&neg_sig_point) {
        panic!("Signature not in G1 subgroup");
    }

    // 3. Construct drand message: SHA256(round) (unchained quicknet mode)
    let round_bytes = Bytes::from_slice(env, &round.to_be_bytes());
    let message: Bytes = env.crypto().sha256(&round_bytes).into();

    // 4. Hash-to-Curve (on-chain H2C)
    let dst = Bytes::from_slice(env, b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_");
    let hashed_point = env.crypto().bls12_381().hash_to_g1(&message, &dst);

    // 5. Deserialize drand public key (192 bytes uncompressed G2)
    let pubkey_bytes: BytesN<192> = get_drand_pubkey(env).try_into().unwrap();
    let drand_pubkey = G2Affine::from_bytes(pubkey_bytes);

    // 6. Pairing verification: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
    let g2_gen = get_g2_generator(env);
    env.crypto().bls12_381().pairing_check(
        Vec::from_array(env, [neg_sig_point, hashed_point]),
        Vec::from_array(env, [g2_gen, drand_pubkey])
    );
}
```

**Key Security Properties:**

1. **Signature authenticity**: Pairing check proves signature came from drand's private key
2. **Message integrity**: Hash-to-curve performed on-chain prevents message tampering
3. **Replay protection**: Each cartridge is assigned a specific drand round at mint time; finalization enforces round match and marks cartridge as finalized
4. **Subgroup safety**: All points verified to be in correct subgroups (prevents attacks)
5. **On-chain verification**: All cryptographic operations happen on-chain (immutable)

**Why relayer can't cheat**: The relayer only provides uncompressed byte arrays. The contract:

- Re-verifies all cryptographic properties
- Performs H2C itself (relayer can't influence this)
- Checks pairing equation (can't be faked without private key)
- Validates subgroup membership (prevents invalid point attacks)

**Byte Order Note:**
Soroban uses **c1-first** byte order for Fp2 field elements per CAP-0059: `x_c1 || x_c0 || y_c1 || y_c0`

This is the SAME as IETF standard format:

- IETF compressed: `x_c1 || x_c0` (96 bytes for G2)
- Soroban uncompressed: `x_c1 || x_c0 || y_c1 || y_c0` (192 bytes for G2, CAP-0059)
- Solidity (EVM): `x_c1 || x_c0 || y_c1 || y_c0` (also follows IETF/CAP-0059)

See `/docs/reference-implementations/QuicknetRegistry.sol` for a working Solidity reference implementation.

**Testing:**

```bash
# Test full verification flow with live drand data
bash scripts/testBLS12381.sh

# Verify standalone with noble-curves (matches Soroban logic)
npx tsx scripts/verifyDrandSignatureLocally.ts
```

**References:**

- **CAP-0059**: Stellar protocol specification for BLS12-381 host functions
- **Drand Quicknet**: Chain hash `52db9ba...` with 3-second rounds
- **BLS DST**: `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_` (RFC 9380)
- **Reference Implementations**: `/docs/reference-implementations/` (Solidity, verification scripts)

**CRITICAL: Soroban G2 Byte Order**

Soroban uses IETF standard byte order per CAP-0059 for G2 points (Fp² field elements):

- **Soroban format (CAP-0059)**: `x_c1 || x_c0 || y_c1 || y_c0` (each component 48 bytes, big-endian)
- **IETF standard**: `x_c1 || x_c0 || y_c1 || y_c0` (used by @noble/curves and most libraries)

This affects:

1. **G2 point decompression** in `src/services/entropyRelayer.ts:decompressG2Point()`
   - Must swap component order after decompressing with @noble/curves
   - Input: compressed 96 bytes → Output: x_c0 || x_c1 || y_c0 || y_c1 (192 bytes)
2. **Drand public key** in `environments.toml` constructor_args
   - Must be reordered from drand quicknet's compressed format
   - Use `scripts/decompressDrandPubkey.ts` to get correct format
3. **G2 generator** in contract (`lib.rs:519-546`)
   - Hardcoded in Soroban byte order
4. **Contract initialization** round-trip test (`lib.rs:507-511`)
   - Validates: `G2Affine::from_bytes() → to_bytes()` returns identical bytes

**Verification:**

```bash
# Test decompression outputs correct byte order
npx tsx scripts/testDecompression.ts
# Should show: Match: ✅
```

This was discovered through systematic testing: IETF-ordered bytes caused "UnreachableCodeReached" errors during pairing verification. The round-trip test proved Soroban expects c0-first ordering.

### Environment Configuration (`environments.toml`)

Multi-environment setup with three tiers:

- **development**: Local network (Docker), auto-deploys contracts with `client = true`
- **staging**: Stellar testnet
- **production**: Stellar mainnet

Each environment configures:

```toml
[environment.network]
rpc-url = "..."
network-passphrase = "..."
run-locally = true  # Auto-start Docker container (dev only)

[[environment.accounts]]
name = "me"
default = true  # Used as --source for commands

[environment.contracts.contract_name]
client = true  # Generate TypeScript bindings (dev/testing only)
constructor_args = "--admin me --param value"
after_deploy = "reset\nother_command"  # Commands to run after deployment
```

**Important**: Contract name in `environments.toml` must match underscored `name` in contract's `Cargo.toml`.

**Frontend environment variables** (`.env`):

- `STELLAR_SCAFFOLD_ENV`: Which environment to use from `environments.toml`
- `PUBLIC_*` prefix: Required for React code access
- Network config: `PUBLIC_STELLAR_NETWORK`, `PUBLIC_STELLAR_NETWORK_PASSPHRASE`, `PUBLIC_STELLAR_RPC_URL`, `PUBLIC_STELLAR_HORIZON_URL`

**CRITICAL: Contract ID Management**

⚠️ **The `.env` file is the SINGLE SOURCE OF TRUTH for contract IDs!**

Auto-generated TypeScript bindings in `packages/gene_splicer/` cannot be relied upon for staging/production deployments because:

- `client = true` only works in development environment
- Staging/production deployments don't regenerate TypeScript bindings
- Hardcoded IDs in source files become stale after redeployment

**Deployment Workflow:**

1. Build contract: `cargo build --release`
2. Install WASM: `stellar contract install --wasm target/wasm32v1-none/release/gene_splicer.wasm --network testnet`
3. Deploy contract: `stellar contract deploy --wasm-hash <hash> --network testnet -- <constructor-args>`
4. **UPDATE ALL CONTRACT ID LOCATIONS**:
   - `.env`: Copy new contract ID to `PUBLIC_GENE_SPLICER_CONTRACT_ID`
   - `.github/workflows/deploy.yml`: Update `PUBLIC_GENE_SPLICER_CONTRACT_ID` in build env vars
5. Restart dev server: Kill server, run `npm start`
6. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

**Contract ID is used in:**

- `.env` - Local development contract ID (gitignored)
- `.github/workflows/deploy.yml` - GitHub Pages deployment contract ID (line 40)
- `src/contracts/gene_splicer.ts` - Read operations (queries)
- `src/contracts/util.ts` - Write operations (createGeneSplicerClient)

Both frontend files read from `import.meta.env.PUBLIC_GENE_SPLICER_CONTRACT_ID` with validation to ensure it's set.

### Contracts Structure

Rust workspace at `contracts/` with game contracts:

- **gene-splicer**: Main game contract with BLS12-381 entropy verification
  - `splice_genome()`: Mint Genome Cartridge NFT with PRNG skin, assign future drand round
  - `finalize_splice()`: Verify drand entropy inline (BLS12-381 CAP-0059) and generate creature genes
  - `extend_ttl()`: Permissionless TTL extension to prevent data expiration
  - `verify_drand_signature()`: Full BLS12-381 pairing verification (internal)
    - G1Affine/G2Affine deserialization from uncompressed bytes
    - Subgroup membership checks on all points
    - On-chain Hash-to-Curve (H2C) with drand DST
    - Pairing equation verification: `e(sig, G2_gen) == e(H(msg), pubkey)`

**OpenZeppelin Patterns Used:**

- `#[default_impl]` macro: Reduces boilerplate for trait implementations
- `#[only_role(account, "role")]` macro: Access control (from `stellar-macros`)
- Associated types for mutually exclusive extensions (e.g., `ContractType = AllowList`)
- Dual-layer API: high-level (with checks) and low-level (manual verification) functions

**Workspace Configuration** (`Cargo.toml`):

```toml
[workspace.dependencies.stellar-tokens]
git = "https://github.com/OpenZeppelin/stellar-contracts"
tag = "v0.5.1"
```

**Build Profiles:**

- `release`: Optimized WASM (opt-level "z", LTO, strip symbols)
- `release-with-logs`: Same as release but keeps debug assertions

### Frontend Structure

```text
src/
├── components/          # UI components (wallet, contracts, layout)
├── contracts/
│   └── util.ts         # Network config, environment parsing, Stellar Lab URL generation
├── debug/              # Interactive contract explorer/debugger
│   ├── components/     # Auto-generated contract method forms
│   ├── hooks/          # Contract interaction hooks
│   └── types/          # TypeScript types for contracts
├── hooks/              # React hooks (wallet, subscriptions, notifications, balance)
├── pages/
│   ├── Home.tsx        # Main game UI
│   └── Debugger.tsx    # Contract debugging interface (/debug route)
├── providers/
│   ├── WalletProvider.tsx      # Stellar wallet integration (@creit.tech/stellar-wallets-kit)
│   └── NotificationProvider.tsx # Toast notifications
├── services/
│   └── entropyRelayer.ts  # BLS12-381 decompression for drand entropy
├── util/               # Utility functions
├── App.tsx             # Main app with React Router
└── main.tsx            # Entry point (QueryClient + providers)
```

**Key Services:**

- **entropyRelayer.ts**: NON-SECURITY-CRITICAL BLS12-381 point decompression
  - `decompressG1Point()`: 48 bytes compressed → 96 bytes uncompressed (x || y)
  - `decompressG2Point()`: 96 bytes compressed → 192 bytes uncompressed (x_c0 || x_c1 || y_c0 || y_c1)
  - `fetchLatestDrandEntropy()`: Fetch from drand quicknet API
  - `parseAndDecompressEntropy()`: Full entropy preparation for contract submission
  - `getUncompressedPublicKey()`: Get 192-byte uncompressed drand public key

**Key Patterns:**

- **Contract Clients**: Auto-generated in `packages/` by `stellar scaffold watch`, imported for use
- **Wallet Integration**: Supports Freighter, xBull, Albedo via Stellar Wallet Kit
- **State Management**: React Query + Context API
- **Styling**: Stellar Design System (`@stellar/design-system`) + CSS modules

### Contract Client Generation Flow

When `client = true` in `environments.toml`:

1. Rust contract source compiled to WASM
2. Contract deployed to network
3. Constructor called with `constructor_args`
4. `after_deploy` commands executed (e.g., initialization transactions)
5. TypeScript client generated to `packages/<contract-name>/`
6. Client auto-importable in frontend (NPM workspace)

**Requirements:**

- Contract in local `contracts/` workspace
- Name match: `environments.toml` key = underscored `Cargo.toml` name
- Only works in `development` or `testing` environments

### IMPORTANT: Always Use Stellar Scaffold's Deployment System

**DO NOT manually deploy contracts** when working in development. Always rely on `stellar scaffold watch` to handle deployment and TypeScript bindings generation.

**Why this matters:**

- Manually deploying contracts creates a mismatch between the deployed contract schema and the auto-generated TypeScript bindings
- The scaffold watches for contract changes and automatically:
  1. Compiles Rust contracts to WASM
  2. Deploys to the configured network
  3. Calls constructor with `constructor_args` from `environments.toml`
  4. Runs `after_deploy` commands
  5. Generates TypeScript client with matching schema in `packages/<contract-name>/`
  6. Updates the `networks` object with the new contract ID

**Common mistake:**

```bash
# ❌ DON'T DO THIS in development
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/contract.wasm
stellar contract invoke --id <manual-id> -- initialize --args...
```

**Correct approach:**

```bash
# ✅ DO THIS - let scaffold handle everything
npm run dev
# Scaffold watch automatically deploys when you save contract changes
```

**How to use the auto-generated client:**

```typescript
// In src/contracts/contract_name.ts - helper file that uses scaffold-generated package
import { Client, networks } from "contract_name"; // From packages/contract_name/
import { rpcUrl } from "./util";

// Use the auto-generated network configuration
export default new Client({
  ...networks.standalone, // Includes contractId from scaffold deployment
  rpcUrl,
  allowHttp: true,
  publicKey: undefined,
});
```

```typescript
// In components
import ContractClient from "../contracts/contract_name";

// Use directly - no need to instantiate
const tx = await ContractClient.method_name({ args });
const result = await tx.simulate();
```

**If you need to redeploy clean:**

```bash
# Remove old deployment state
rm -rf .stellar packages/contract_name node_modules/.vite

# Restart dev server - scaffold will deploy fresh
npm run dev
```

### Future Development: NFT Image Generation & Pinning

**Status**: Not yet implemented. Creatures currently display as client-side PNG composites.

**Planned Features:**

- **Serverless NFT generation**: Generate composite creature images from gene combinations
- **IPFS pinning via Pinata**: Pin images and metadata to IPFS
- **Standard metadata format**: NFT metadata with traits (Head Gene, Body Gene, Leg Gene, Rarities)
- **On-demand generation**: Trigger image generation when users finalize creatures

**Potential Implementation:**

```typescript
// Using Pinata SDK
import { PinataSDK } from "pinata";
const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
});

// Upload image
const imageFile = await generateCreatureImage(genes);
const imageUpload = await pinata.upload.file(imageFile);
const imageUrl = `https://gateway.pinata.cloud/ipfs/${imageUpload.IpfsHash}`;

// Upload metadata
const metadata = {
  name: `Creature #${tokenId}`,
  image: imageUrl,
  attributes: [
    { trait_type: "Head Gene", value: genes.head, rarity: "Legendary" },
    { trait_type: "Body Gene", value: genes.body, rarity: "Rare" },
    { trait_type: "Leg Gene", value: genes.legs, rarity: "Normal" },
  ],
};
const metadataUpload = await pinata.upload.json(metadata);
```

**Asset Organization:**

- Gene segment source images in `public/assets/creatures/`
- Organized by type: `heads/`, `bodys/`, `legs/`, etc.
- Consistent naming: `head-0.png` through `head-14.png`

### OpenZeppelin Best Practices (from Architecture.md)

When writing Soroban contracts, follow these principles:

1. **Trait-Based Design**: Use associated types for mutually exclusive extensions

   ```rust
   impl NonFungibleToken for MyContract {
       type ContractType = Enumerable;  // Forces compile-time exclusivity
   }
   ```

2. **Dual-Layer API**: Provide high-level (secure) and low-level (flexible) functions
   - High-level: Include auth checks, state updates, event emissions
   - Low-level: Manual control for custom workflows

3. **Modular Extensions**: Mix and match traits (Burnable, Pausable, Upgradeable, etc.)

   ```rust
   #[default_impl]
   #[contractimpl]
   impl FungibleBurnable for MyToken {}

   #[contractimpl]
   impl Pausable for MyToken {}
   ```

4. **Macro Usage**: Use macros to reduce boilerplate and improve clarity
   - `#[default_impl]`: Auto-implement trait methods
   - `#[only_role(operator, "manager")]`: Declarative access control
   - `#[when_not_paused]`: Declarative pausable checks

5. **Storage Key Design**: Use enums for structured storage

   ```rust
   #[contracttype]
   pub enum StorageKey {
       Balance(Address),
       TotalSupply,
   }
   ```

6. **TTL Management**: Extend storage entries to prevent expiration (except `instance` storage)

7. **Performance**: Optimize for write operations (reads are free on Stellar)
   - Be generous with read operations
   - Minimize storage writes
   - Computation is cheap; prioritize clean, maintainable code

8. **SEP Compliance**: Follow SEP-41 for fungible tokens, use compatible patterns for NFTs

9. **Testing**: Comprehensive unit tests, integration tests, property-based testing

10. **Code Style**: Strictly follow `cargo fmt` and `cargo clippy` rules; prefer declarative over imperative code

## Testing & Scripts

### BLS12-381 Verification Testing

```bash
# End-to-end test with live drand data
bash scripts/testBLS12381.sh
# Fetches latest drand entropy, decompresses, and submits to contract
# Verifies full BLS12-381 pairing check with all security properties

# Helper: Get uncompressed drand public key (for contract initialization)
npx tsx scripts/getDrandPubkey.ts
# Outputs 192-byte hex string for --drand_public_key parameter

# Helper: Fetch and decompress drand entropy (JSON output)
npx tsx scripts/fetchAndDecompressDrand.ts
# Returns: {"round": 123, "randomness": "0x...", "signature": "0x..."}
```

**Test Scripts:**

- `scripts/testBLS12381.sh`: Full verification flow test
  - Fetches live drand quicknet entropy
  - Decompresses BLS12-381 signature (G1: 48→96 bytes)
  - Submits to contract for on-chain verification
  - Validates all 8 verification steps pass
- `scripts/getDrandPubkey.ts`: Extract uncompressed drand public key
- `scripts/fetchAndDecompressDrand.ts`: Fetch and decompress entropy helper

## Debugging

### Contract Debugger

Navigate to `/debug` route for interactive contract explorer:

- Auto-generated forms for all deployed contract methods
- Transaction result inspection
- Contract state viewer
- Links to Stellar Lab for detailed transaction analysis

### Stellar Lab

The app generates Stellar Lab URLs for transaction inspection. Links include network configuration and open directly to transaction dashboard.

### Logging

Use `log` events in contracts (visible in `release-with-logs` profile):

```rust
env.logs().log("message", value);
```

## Common Development Workflows

### Adding a New Contract

1. Create contract in `contracts/<name>/`
2. Add to workspace in root `Cargo.toml`
3. Configure in `environments.toml` with `client = true`
4. Add `constructor_args` and `after_deploy` commands
5. Run `npm run dev` to auto-deploy and generate TS client
6. Import client in React: `import * as MyContract from 'my-contract-client'`

### Testing Contract Changes

1. Modify contract Rust code
2. Save (triggers auto-rebuild via watch)
3. Contract auto-redeploys to local network
4. Frontend hot-reloads with new contract client
5. Test in UI or `/debug` explorer

### Deploying to Testnet

1. Update `.env`: Set `STELLAR_SCAFFOLD_ENV=staging`
2. Configure testnet account in `environments.toml` under `[staging]`
3. Fund account via friendbot or manual transfer
4. Run: `stellar registry publish --wasm target/wasm32-unknown-unknown/release/contract.wasm`
5. Run: `stellar registry deploy --contract-name instance --wasm-name contract -- <constructor-args>`
6. Update frontend to use testnet contract ID

## Resources

- **Scaffold Stellar Docs**: https://scaffoldstellar.com/docs
- **OpenZeppelin Stellar Contracts**: https://docs.openzeppelin.com/stellar-contracts
- **Stellar Docs**: https://developers.stellar.org/docs
- **Soroban SDK**: https://docs.rs/soroban-sdk
- **Drand Documentation**: https://drand.love/docs
- **CAP-0059 (Randomness)**: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md
