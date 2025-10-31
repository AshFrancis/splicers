# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important: Git Commit Policy

**DO NOT add yourself to git commits.** When creating commits, use simple commit messages without any co-authorship lines or AI attribution. All credit goes to the repository owner. Do not include:
- `Co-Authored-By: Claude <noreply@anthropic.com>`
- Any mention of AI assistance
- Attribution to Claude or Anthropic

## Project Overview

This is a **Gene Splicing NFT Game** built on Stellar's Soroban smart contract platform, using the Scaffold Stellar framework. The game allows players to splice gene segments to create unique creatures as NFTs. See `/docs/specs/gene-splicing-v1.md` for the full game specification.

**Tech Stack:**
- **Smart Contracts**: Rust with Soroban SDK (compiled to WASM)
- **Frontend**: Vite + React + TypeScript
- **Backend Services**: Node.js (drand relay, NFT generation via Pinata, finalization)
- **Deployment**: Backend on fly.io (1 always-on machine)
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

### Backend Services (Node.js)

```bash
# From backend/ directory
cd backend

# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production
npm start

# Run individual services (for testing)
npm run service:drand
npm run service:nft
npm run service:finalize
```

### Contract Operations

```bash
# Test contracts
cargo test

# Build contracts manually (if not using watch)
cargo build --target wasm32-unknown-unknown --release

# Registry operations (testnet/mainnet)
stellar registry publish --wasm path/to/contract.wasm --wasm-name my-contract
stellar registry deploy --contract-name instance --wasm-name my-contract -- --arg1 value1
stellar registry install my-contract-instance

# Direct contract invocation
stellar contract invoke --id <contract-id> -- <method> --arg value
```

### fly.io Deployment

```bash
# From backend/ directory
cd backend

# Login to fly.io
fly auth login

# Create app (first time only)
fly apps create gene-splicer-backend

# Set secrets
fly secrets set STELLAR_SECRET_KEY=<key>
fly secrets set PINATA_JWT=<jwt>
fly secrets set CONTRACT_ID=<id>

# Deploy
fly deploy

# View logs
fly logs

# SSH into machine
fly ssh console

# Check status
fly status
```

## Architecture

### Game Contract Lifecycle (Gene Splicing)

1. **splice_genome()**: Player pays 1 XLM fee, receives Genome Cartridge NFT with cosmetic skin (via Soroban PRNG), game stores splice_round
2. **submit_entropy(round, randomness, signature)**: Off-chain service submits drand entropy with CAP-0059 verification
3. **finalize_splice(id)**: Permissionless function that uses drand-verified entropy to select genes (head, torso, legs) and mint final Creature NFT

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

### Contracts Structure

Rust workspace at `contracts/` with example contracts:
- **guess-the-number**: Demonstrates XLM SAC transfers, PRNG, admin patterns, contract upgrades
- **fungible-allowlist**: SEP-41 token with OpenZeppelin AllowList + role-based access control
- **nft-enumerable**: NFT with OpenZeppelin Enumerable extension for token enumeration

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

```
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
├── util/               # Utility functions
├── App.tsx             # Main app with React Router
└── main.tsx            # Entry point (QueryClient + providers)
```

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

### Backend Services Architecture (Node.js)

The game requires three backend services running as a single Node.js application on fly.io.

**Project Structure:**
```
backend/
├── src/
│   ├── services/
│   │   ├── drand-relay.ts      # Fetches and submits drand entropy
│   │   ├── nft-generator.ts    # Generates images and pins to Pinata
│   │   └── finalizer.ts        # Auto-finalizes pending cartridges
│   ├── utils/
│   │   ├── stellar.ts          # Stellar SDK helpers
│   │   ├── pinata.ts           # Pinata IPFS client
│   │   └── logger.ts           # Winston logger
│   ├── types/
│   │   └── contract.ts         # TypeScript types for contract data
│   └── index.ts                # Main entry point (starts all services)
├── assets/
│   └── genes/                  # Gene segment images (head, torso, legs)
├── package.json
├── tsconfig.json
├── Dockerfile                  # For fly.io deployment
├── fly.toml                    # fly.io configuration
└── .env.example                # Environment variable template
```

#### Service 1: Drand Entropy Relay

**Purpose**: Fetch drand randomness beacons and submit to contract for verifiable randomness.

**Key Functions:**
- Poll drand HTTP API for new randomness rounds
- Verify drand signatures (CAP-0059 compliance)
- Submit `submit_entropy(round, randomness, signature)` to contract
- Track last submitted round in memory/DB to avoid duplicates
- Handle network retries with exponential backoff

**Implementation:**
```typescript
// Example polling logic
setInterval(async () => {
  const latestRound = await fetchLatestDrandRound();
  if (latestRound > lastSubmittedRound) {
    await submitEntropyToContract(latestRound);
  }
}, POLL_INTERVAL);
```

#### Service 2: NFT Image Generation & Pinning (Pinata)

**Purpose**: Generate creature images from gene combinations and pin to IPFS via Pinata.

**Key Functions:**
- Listen for contract events or poll for finalized creatures
- Fetch gene data from contract (head_gene, torso_gene, leg_gene)
- Generate composite creature image using Canvas or Sharp
- Pin image to Pinata IPFS
- Generate and pin metadata JSON with Pinata gateway URL
- Optionally update contract with metadata URI

**Pinata Integration:**
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
    { trait_type: "Head Gene", value: genes.head },
    { trait_type: "Torso Gene", value: genes.torso },
    { trait_type: "Leg Gene", value: genes.legs }
  ]
};
const metadataUpload = await pinata.upload.json(metadata);
```

**Asset Management:**
- Store gene segment images in `backend/assets/genes/`
- Organize by type: `heads/`, `torsos/`, `legs/`
- Use consistent naming: `head_1.png`, `head_2.png`, etc.
- Load assets on startup for fast composite generation

#### Service 3: Permissionless Finalization

**Purpose**: Automatically call `finalize_splice(id)` for cartridges ready but not finalized by users.

**Key Functions:**
- Poll contract for pending Genome Cartridge NFTs
- Check if entropy available for cartridge's splice_round
- Wait grace period (e.g., 1 hour) before auto-finalization
- Call `finalize_splice(id)` when conditions met
- Track finalization status to avoid duplicate calls

**Implementation Notes:**
- Grace period allows users to finalize themselves first
- Service pays transaction fees but function is permissionless
- Can batch multiple finalizations if contract supports it
- Implement priority queue: oldest cartridges first

#### Backend Dependencies (package.json)

```json
{
  "name": "gene-splicer-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "service:drand": "tsx src/services/drand-relay.ts",
    "service:nft": "tsx src/services/nft-generator.ts",
    "service:finalize": "tsx src/services/finalizer.ts"
  },
  "dependencies": {
    "@stellar/stellar-sdk": "^14.2.0",
    "pinata": "^1.0.0",
    "canvas": "^2.11.2",
    "dotenv": "^16.4.5",
    "winston": "^3.11.0",
    "pg": "^8.11.3"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

#### Environment Variables (backend/.env)

```bash
# Stellar Network
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
STELLAR_SECRET_KEY=S...  # Service account (needs XLM for fees)

# Contract
CONTRACT_ID=C...

# Drand
DRAND_API_URL=https://api.drand.sh
DRAND_CHAIN_HASH=8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce
POLL_INTERVAL_MS=30000

# Pinata
PINATA_JWT=eyJ...        # JWT from Pinata dashboard
PINATA_GATEWAY=gateway.pinata.cloud

# NFT Generation
ASSET_PATH=./assets/genes
CHECK_INTERVAL_MS=60000

# Finalization
GRACE_PERIOD_MS=3600000  # 1 hour
FINALIZE_BATCH_SIZE=10

# Database (optional, for state tracking)
DATABASE_URL=postgresql://user:pass@host:5432/genesplicer

# Logging
LOG_LEVEL=info
```

#### fly.io Configuration (fly.toml)

```toml
app = "gene-splicer-backend"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  DRAND_API_URL = "https://api.drand.sh"
  PINATA_GATEWAY = "gateway.pinata.cloud"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false  # Keep always-on
  auto_start_machines = false
  min_machines_running = 1    # 1 always-on machine

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

#### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install canvas dependencies
RUN apk add --no-cache \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .
RUN npm run build

# Copy assets
COPY assets ./dist/assets

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### Deployment Strategy

**fly.io Configuration:**
- 1 always-on machine (no auto-stop)
- Shared CPU (sufficient for background tasks)
- 512MB RAM (increase if needed for image processing)
- Secrets stored in fly.io (use `fly secrets set`)

**Monitoring & Reliability:**
- Health check endpoint at `/health` returning service status
- Winston logging to stdout (captured by fly.io logs)
- Sentry or similar for error tracking (optional)
- Set up fly.io alerts for machine crashes

**Cost Management:**
- fly.io free tier includes 3 shared-cpu VMs with 256MB RAM
- Upgrade to 512MB RAM if image generation needs it
- Monitor Pinata usage (free tier: 1GB storage, 100 API calls/month)

**Scaling Considerations:**
- For high volume, separate services into multiple fly.io apps
- Use fly.io Postgres for shared state between services
- Add Redis for job queues if needed (Bull, BullMQ)

**Deployment Checklist:**
1. Create fly.io app: `fly apps create gene-splicer-backend`
2. Set all secrets: `fly secrets set KEY=value`
3. Deploy: `fly deploy`
4. Verify logs: `fly logs`
5. Test services are running: check contract for entropy submissions
6. Monitor costs: `fly dashboard`

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

## Debugging

### Contract Debugger

Navigate to `/debug` route for interactive contract explorer:
- Auto-generated forms for all deployed contract methods
- Transaction result inspection
- Contract state viewer
- Links to Stellar Lab for detailed transaction analysis

### Backend Services Debugging

```bash
# View fly.io logs in real-time
fly logs

# SSH into running machine
fly ssh console

# Check service status
curl https://gene-splicer-backend.fly.dev/health

# Local debugging with tsx watch
cd backend
npm run dev
```

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
7. Update backend env vars and redeploy: `fly deploy`

### Updating Backend Services

1. Make changes to `backend/src/`
2. Test locally: `cd backend && npm run dev`
3. Commit changes
4. Deploy to fly.io: `fly deploy`
5. Monitor logs: `fly logs`

### Testing NFT Generation Locally

1. Start local Stellar network: `npm run dev`
2. Deploy contract locally
3. Run backend services locally: `cd backend && npm run dev`
4. Trigger splice in UI
5. Watch logs for drand submission, finalization, NFT generation
6. Check Pinata dashboard for uploads

## Resources

- **Scaffold Stellar Docs**: https://scaffoldstellar.com/docs
- **OpenZeppelin Stellar Contracts**: https://docs.openzeppelin.com/stellar-contracts
- **Stellar Docs**: https://developers.stellar.org/docs
- **Soroban SDK**: https://docs.rs/soroban-sdk
- **Drand Documentation**: https://drand.love/docs
- **CAP-0059 (Randomness)**: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md
- **Pinata Docs**: https://docs.pinata.cloud
- **fly.io Docs**: https://fly.io/docs
