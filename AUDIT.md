# Splicers Codebase Audit

**Date:** 2026-04-02
**Scope:** Full codebase (smart contract, frontend, backend server, CI/CD, scripts, documentation)
**Method:** 8-pass systematic review covering security, correctness, performance, testing, deployment, documentation, and operations

---

## Summary

| Severity  | Count  |
| --------- | ------ |
| Critical  | 4      |
| High      | 14     |
| Medium    | 17     |
| Low       | 14     |
| **Total** | **49** |

---

## Critical Findings

### CRIT-01: Contract tests completely broken — zero test coverage

**Category:** Testing
**Files:** `contracts/gene-splicer/src/test.rs`

All 9 contract tests fail to compile. They reference methods that don't exist in the contract:

- `client.initialize(...)` — contract uses `__constructor` (CAP-0058), not a callable `initialize()`
- `client.submit_entropy(...)` — no such method; entropy is submitted inline via `finalize_splice()`
- `client.get_entropy(...)` — no such method
- `client.finalize_splice(&cartridge_id)` — actual signature takes 5 arguments, not 1

**Impact:** The contract's core minting and finalization flow has zero working test coverage. Any regression would go undetected.

**Recommendation:** Rewrite all tests to match the current contract API. Priority test cases: splice_genome fee handling, finalize_splice with valid/invalid entropy, double finalization prevention, BLS verification with real drand data.

**Effort:** High

---

### CRIT-02: CI pipeline never runs — branch name mismatch

**Category:** Deployment
**File:** `.github/workflows/node.yml:5`

```yaml
branches: ["main"] # But repo uses "master"
```

The build-and-test workflow triggers on push to `"main"`, but the repository's primary branch is `master`. This means CI (linting, building, testing) never runs automatically on push.

**Impact:** Broken code, lint failures, and test regressions are never caught before merge.

**Recommendation:** Change to `branches: ["master"]`.

**Effort:** Low

---

### CRIT-03: Production deploys without running tests or lint

**Category:** Deployment
**File:** `.github/workflows/deploy.yml`

The deploy workflow runs `npm ci` and `npm run build` but never runs `npm test` or `npm run lint`. Combined with CRIT-02 (CI never runs), code is deployed to production with zero automated quality checks.

**Recommendation:** Add `npm run lint` and `npm test` steps before `npm run build` in the deploy workflow.

**Effort:** Low

---

### CRIT-04: 32 known dependency vulnerabilities (6 high severity)

**Category:** Security
**File:** `package.json`

`npm audit` reports 32 vulnerabilities including:

- **6 high severity** — react-router XSS in ScrollRestoration, untrusted redirect paths
- 2 moderate, 24 low

**Recommendation:** Run `npm audit fix` and update react-router-dom to a patched version.

**Effort:** Low

---

## High Severity Findings

### HIGH-01: Debug tools accessible in production

**Category:** Security
**File:** `src/App.tsx:50-51`

The `/debug` and `/debug/:contractName` routes are unconditionally rendered and visible in the navigation header. The debugger gives full read/write access to every contract method with arbitrary parameters.

```tsx
<Route path="/debug" element={<Debugger />} />
<Route path="/debug/:contractName" element={<Debugger />} />
```

**Recommendation:** Gate behind environment check (`import.meta.env.DEV`) or remove from production builds entirely.

**Effort:** Low

---

### HIGH-02: Backend CORS allows all origins

**Category:** Security
**File:** `server/index.ts:36`

```typescript
"Access-Control-Allow-Origin": "*"
```

Any website can call `/api/pin-creature` (consuming Pinata quota) and `/api/keep-alive` (triggering on-chain transactions with the server's funded wallet).

**Recommendation:** Restrict to `https://splicers.net`.

**Effort:** Low

---

### HIGH-03: No rate limiting on server endpoints

**Category:** Security
**File:** `server/index.ts`

No mechanism prevents an attacker from spamming `/api/pin-creature` (consuming Pinata API quota and potentially costing money) or `/api/keep-alive` (consuming the server wallet's XLM for transaction fees).

**Recommendation:** Add per-IP rate limiting (e.g., 10 requests/minute for pinning, 1/hour for keep-alive).

**Effort:** Medium

---

### HIGH-04: No input validation on pinning endpoint

**Category:** Security
**File:** `server/index.ts:54-62`, `server/pinning.ts:9-21`

The `/api/pin-creature` endpoint checks field presence but not type or range. An attacker can pass `creatureId: -1`, `headGeneId: 999`, or string values. The `getGeneRarity` function returns "Normal" for any out-of-range ID, creating invalid metadata on IPFS.

No verification that the creature actually exists on-chain before pinning.

**Recommendation:** Validate all IDs are non-negative integers, geneIds are 0-14, and query the contract to verify the creature exists.

**Effort:** Medium

---

### HIGH-05: NotificationProvider isVisible bug

**Category:** Correctness
**File:** `src/providers/NotificationProvider.tsx:86`

```tsx
notification.id === id
  ? { ...notification, isVisible: true }  // BUG: should be false
  : notification,
```

The `markRead` function sets `isVisible: true` when it should set `false` to trigger the slide-out CSS animation. Notifications never visually fade out — they just get removed abruptly after the 5-second timer.

**Recommendation:** Change `isVisible: true` to `isVisible: false`.

**Effort:** Low

---

### HIGH-06: Silent fallback to LOCAL network on env parse failure

**Category:** Correctness
**File:** `src/contracts/util.ts:20-27`

```typescript
const env = parsed.success
  ? parsed.data
  : {
      PUBLIC_STELLAR_NETWORK: "LOCAL",
      PUBLIC_STELLAR_RPC_URL: "http://localhost:8000/rpc",
      ...
    };
```

If any environment variable is missing or invalid, the frontend silently falls back to localhost. In production, this would make the app appear to work but connect to nothing.

**Recommendation:** Throw an error in production: `if (!parsed.success && import.meta.env.PROD) throw new Error(...)`.

**Effort:** Low

---

### HIGH-07: WalkingCreatures causes 60 state updates per second

**Category:** Performance
**File:** `src/components/WalkingCreatures.tsx:129-265`

The `requestAnimationFrame` callback calls `setWalkingCreatures(...)` on every frame (~60/sec), triggering a full React re-render of all creatures with new inline styles on each frame.

**Recommendation:** Use `useRef` for position state and update DOM directly via refs, or use CSS animations/transforms instead of React state.

**Effort:** High

---

### HIGH-08: N+1 query pattern for cartridges and creatures

**Category:** Performance
**File:** `src/components/GenomeSplicer.tsx`

To display cartridges, the component calls `get_user_cartridges()` to get IDs, then `get_cartridge()` individually for each ID. With 20 cartridges, that's 21 RPC calls every poll cycle. Same pattern for creatures.

**Recommendation:** Add a batch query function to the contract (e.g., `get_cartridges_batch(ids: Vec<u32>)`) or cache results client-side.

**Effort:** Medium

---

### HIGH-09: No monitoring or alerting for contract TTL

**Category:** Operations
**Files:** `server/keepAlive.ts`, `.github/workflows/keep-alive.yml`

If the keep-alive server crashes and the GitHub Action fails (e.g., invalid secret key), the contract data will silently expire after 30 days. No alerting exists for:

- Keep-alive failure
- Server downtime
- Low wallet balance
- TTL approaching threshold

**Recommendation:** Add health check monitoring and failure alerts (e.g., email, Discord webhook on keep-alive failure).

**Effort:** Medium

---

### HIGH-10: Contract ID duplicated in 4 places

**Category:** Deployment
**Files:** `.env:52`, `.github/workflows/deploy.yml:40`, `.github/workflows/keep-alive.yml:29`, `server/keepAlive.ts:3`

Every contract redeployment requires manually updating the ID in four separate files. Missing one causes silent failures.

**Recommendation:** Store contract ID in a GitHub secret and reference it in workflows. Have the server read from `.env` without a hardcoded fallback.

**Effort:** Medium

---

### HIGH-11: Hardcoded contract ID fallback in keepAlive.ts

**Category:** Correctness
**File:** `server/keepAlive.ts:1-2`

```typescript
const CONTRACT_ID =
  process.env.CONTRACT_ID ||
  "CAW7YINV7N7IS64QBSO2YHPNJY7DPEID2V2L6VIYRO4GSTWOB5JDINEB";
```

If `CONTRACT_ID` env var is missing, silently uses a potentially stale contract ID.

**Recommendation:** Make it required: throw if not set.

**Effort:** Low

---

### HIGH-12: No fetch timeout on drand API calls

**Category:** Correctness
**File:** `src/services/entropyRelayer.ts`

`fetch()` has no timeout. If `api.drand.sh` is unresponsive, the user's finalization attempt hangs indefinitely.

**Recommendation:** Add `AbortController` with a 10-second timeout.

**Effort:** Low

---

### HIGH-13: `test_full_verification` is a pub fn in production code

**Category:** Security
**File:** `contracts/gene-splicer/src/lib.rs:546`

This debug/test function is exported as a public contract method. While it's read-only (no state mutation), it adds attack surface and wastes WASM size.

**Recommendation:** Remove from production code or move to a separate test contract.

**Effort:** Low

---

### HIGH-14: Gene rarity logic duplicated across 3 codebases

**Category:** Maintainability
**Files:** `contracts/gene-splicer/src/lib.rs:474-492`, `server/pinning.ts:9-21`, `src/components/BattleArena.tsx:78-97`

The gene ID to rarity/type mapping is hardcoded in three places. If any changes, the others become inconsistent, creating incorrect NFT metadata or wrong battle power calculations.

**Recommendation:** The server should query the contract for actual gene data rather than duplicating the mapping. Frontend should use a shared constants file.

**Effort:** Medium

---

## Medium Severity Findings

### MED-01: Cartridge ID u32 overflow

**File:** `contracts/gene-splicer/src/lib.rs:242`

`cartridge_id + 1` can overflow u32 at 4,294,967,295 mints. While `overflow-checks = true` in release profile will panic, this would brick the contract permanently.

**Recommendation:** Use `checked_add(1).expect("Cartridge ID overflow")` for a clear error message, or switch to u64.

**Effort:** Low

---

### MED-02: verify_signature_compression mask may be wrong

**File:** `contracts/gene-splicer/src/lib.rs:743`

The mask `0x1F` strips the top 3 bits. BLS12-381 compressed G1 format uses only the top 3 bits for flags (bit 7: compression, bit 6: infinity, bit 5: sign). Masking with `0x1F` is correct for this format.

**Status:** Verified correct. No action needed.

---

### MED-03: `extend_ttl_for_contract_instance` extends instance, not WASM code

**File:** `contracts/gene-splicer/src/lib.rs:522-523`

```rust
env.deployer().extend_ttl_for_contract_instance(...)
```

This extends the instance storage TTL, not the WASM code entry TTL. The WASM code has its own TTL that could expire independently.

**Recommendation:** Also call `env.deployer().extend_ttl_for_code()` if available in the SDK, or document that WASM code TTL must be extended via CLI.

**Effort:** Low

---

### MED-04: Hardcoded drand constants in multiple files

**Files:** `contracts/gene-splicer/src/lib.rs:188-189`, `src/components/GenomeSplicer.tsx:56-59`, `src/services/entropyRelayer.ts:21-24`

Drand genesis timestamp (1692803367), period (3s), quicknet URL, and chain hash appear in multiple files.

**Recommendation:** Create a shared `drand.ts` constants file for the frontend. Contract constants are fine as-is (must be self-contained).

**Effort:** Low

---

### MED-05: Console.log calls in BattleArena

**File:** `src/components/BattleArena.tsx`

~27 `console.log("[BATTLE] ...")` calls throughout the component execute during active gameplay, creating GC pressure and I/O overhead.

**Recommendation:** Remove or wrap in `import.meta.env.DEV` check.

**Effort:** Low

---

### MED-06: NPC creature uses hardcoded ID 999

**File:** `src/components/GenomeSplicer.tsx` (BattleArena enemy generation)

The NPC enemy creature uses `id: 999` which could collide with an actual user creature if 999+ cartridges are minted.

**Recommendation:** Use a negative ID, MAX_SAFE_INTEGER, or a separate flag to distinguish NPCs from real creatures.

**Effort:** Low

---

### MED-07: Rarity key mismatch — "common" vs "normal"

**Files:** `src/components/GenomeSplicer.tsx` (calculatePowerLevel), `src/components/BattleArena.tsx` (calculatePower)

GenomeSplicer uses `"common"` for the lowest rarity tier, but the contract returns `GeneRarity::Normal` (serialized as `{tag: "Normal"}`). The power calculation currently falls through to the default case which returns the correct value (3), but for the wrong reason.

BattleArena uses `"normal"` (lowercase). These inconsistencies will cause bugs if the default case changes.

**Recommendation:** Use a single source of truth for rarity names matching the contract's enum variants.

**Effort:** Low

---

### MED-08: No retry logic on critical network operations

**Files:** `server/keepAlive.ts`, `src/providers/WalletProvider.tsx`, `src/services/entropyRelayer.ts`

- Keep-alive: single attempt, no retry on network failure
- Balance fetch: fails silently, no retry
- Drand entropy fetch: no retry

**Recommendation:** Add retry with exponential backoff for keep-alive and drand calls.

**Effort:** Medium

---

### MED-09: Cargo install from source on every keep-alive run

**File:** `.github/workflows/keep-alive.yml:17-19`

```yaml
cargo install stellar-cli --locked # Takes ~10 minutes
```

Every weekly run compiles the entire stellar CLI from source.

**Recommendation:** Use a pre-built binary download or cache the cargo install output.

**Effort:** Medium

---

### MED-10: Husky pre-commit uses deprecated format

**File:** `.husky/pre-commit`

The hook file contains a deprecation warning from Husky. It will break in v10.

**Recommendation:** Update to current Husky format.

**Effort:** Low

---

### MED-11: lint-staged glob too broad

**File:** `package.json` (lint-staged config)

```json
"**/*": ["eslint --fix --no-warn-ignored", "prettier --write --ignore-unknown"]
```

The `**/*` pattern matches all files including images, WASM, and binaries. ESLint will attempt to parse `.png` files.

**Recommendation:** Change to `"**/*.{ts,tsx,js,jsx}"` for ESLint, keep `"**/*"` for Prettier only.

**Effort:** Low

---

### MED-12: CLAUDE.md describes non-existent contract API

**File:** `CLAUDE.md:97-99`

Documents the lifecycle as `splice_genome() -> submit_entropy() -> finalize_splice()`, but `submit_entropy()` doesn't exist. The code sample on lines 136-184 shows chained drand mode with `get_previous_signature()`, but the contract uses unchained quicknet.

**Recommendation:** Update to match actual contract API: `splice_genome() -> finalize_splice(cartridge_id, round, randomness, sig_compressed, sig_uncompressed)`.

**Effort:** Medium

---

### MED-13: TESTING.md references non-existent files

**File:** `TESTING.md`

References E2E test files (`e2e/cartridge-lifecycle.spec.ts`), Playwright configuration, and other test infrastructure that doesn't exist in the repository.

**Recommendation:** Update to reflect actual test coverage (only `entropyRelayer.test.ts` exists).

**Effort:** Low

---

### MED-14: Wildcard CSS override on all elements

**File:** `src/index.css:25-29`

```css
*,
*::before,
*::after {
  border-radius: 0 !important;
}
```

Forces `border-radius: 0` on every element including Stellar Design System internals, causing unnecessary style recalculations and breaking focus indicators.

**Recommendation:** Scope to specific game-related class selectors.

**Effort:** Low

---

### MED-15: No mobile support

**File:** `src/index.css:7`

```css
min-width: 1000px;
```

The app enforces a minimum width of 1000px, making it completely unusable on mobile devices.

**Recommendation:** Add responsive breakpoints or at minimum a "desktop only" message on mobile.

**Effort:** High

---

### MED-16: Server code excluded from linting

**File:** `eslint.config.js:16`

The `server/` directory is in `globalIgnores`, meaning server code is never linted for type errors, unused variables, or other issues.

**Recommendation:** Add a separate ESLint config or tsconfig for the server directory.

**Effort:** Medium

---

### MED-17: WalletProvider error swallowing

**File:** `src/providers/WalletProvider.tsx`

When wallet operations fail, the provider signs the user out (`nullify()`) with only a `console.error`. The user gets no feedback about why they were disconnected.

**Recommendation:** Show a notification via `useNotification()` when wallet errors occur.

**Effort:** Low

---

## Low Severity Findings

### LOW-01: Generic `.unwrap()` calls in contract without context

**File:** `contracts/gene-splicer/src/lib.rs:149-155, 202, 282, 297, 305`

Multiple `.unwrap()` calls on storage reads that would panic with an unhelpful "called unwrap on None" message if instance storage is somehow corrupted.

**Recommendation:** Replace with `.expect("Admin not configured")` etc. for clear error messages.

**Effort:** Low

---

### LOW-02: dev_mode has no post-deploy toggle

**File:** `contracts/gene-splicer/src/lib.rs:70`

`dev_mode` is set in the constructor and cannot be changed afterward. If accidentally deployed with `dev_mode=true`, a full redeployment is required. Current testnet deployment has `dev_mode=false` (verified).

**Recommendation:** Add `set_dev_mode(env, mode: bool)` with admin auth, or accept the immutability as a security feature (prevents admin from disabling verification). Document the rationale.

**Effort:** Low

---

### LOW-03: No admin update functions for config values

**File:** `contracts/gene-splicer/src/lib.rs`

No functions exist to update `xlm_token`, `cartridge_skin_count`, or `drand_public_key` after deployment. Changing any configuration requires full redeployment.

**Recommendation:** Add admin-only setter functions for configurable values.

**Effort:** Medium

---

### LOW-04: G2 PK round-trip check is a debug artifact

**File:** `contracts/gene-splicer/src/lib.rs:841-845`

```rust
let re = drand_pubkey.to_bytes();
if re.to_array() != pubkey_bytes.to_array() {
    panic!("G2 PK byte order mismatch");
}
```

This is a development-time byte order verification. It adds gas cost on every finalization without providing security value (if the pubkey was wrong, the pairing check would fail anyway).

**Recommendation:** Remove this check. The pairing verification is the authoritative correctness check.

**Effort:** Low

---

### LOW-05: Commented-out hello function

**File:** `contracts/gene-splicer/src/lib.rs:308-312`

Dead commented-out code serving as a "force redeployment utility."

**Recommendation:** Remove. Use a proper version bump or WASM hash change for redeployment.

**Effort:** Low

---

### LOW-06: Transfer verification is redundant

**File:** `contracts/gene-splicer/src/lib.rs:168-177`

The balance check after `xlm_client.transfer()` is defensive but unnecessary — Soroban's token transfer will panic on failure. The post-transfer balance check could also false-positive if admin receives funds from another operation in the same transaction (extremely unlikely but possible).

**Recommendation:** Remove the post-transfer balance verification or add a comment explaining the defense-in-depth rationale.

**Effort:** Low

---

### LOW-07: No structured logging in server

**File:** `server/index.ts`, `server/keepAlive.ts`

All logging uses `console.log` / `console.error` with string formatting. No log levels, structured JSON, or correlation IDs.

**Recommendation:** Use a structured logger (or at minimum, add timestamps and log levels).

**Effort:** Low

---

### LOW-08: MutationObserver fighting SDS theme system

**File:** `src/main.tsx:28-37`

A MutationObserver watches `document.body.classList` and forces dark theme, fighting the Stellar Design System's theme management. This is fragile and could cause flickering.

**Recommendation:** Configure SDS theme properly at initialization or file an issue with SDS.

**Effort:** Low

---

### LOW-09: Drand entropy not cached by round

**File:** `src/services/entropyRelayer.ts`

Every call to `fetchDrandEntropy(round)` hits the drand API, even though drand rounds are immutable. Repeated finalization attempts for the same round make redundant API calls.

**Recommendation:** Add a simple in-memory cache by round number.

**Effort:** Low

---

### LOW-10: No prefers-reduced-motion check

**File:** `src/components/WalkingCreatures.tsx`, `src/components/CreatureRenderer.tsx`

Animations run unconditionally. Users with `prefers-reduced-motion` OS setting still see all animations.

**Recommendation:** Check `window.matchMedia('(prefers-reduced-motion: reduce)')` and disable or simplify animations.

**Effort:** Low

---

### LOW-11: SECURITY.md is minimal

**File:** `SECURITY.md`

Only 5 lines for a project handling real XLM transfers and implementing BLS12-381 cryptography.

**Recommendation:** Expand with vulnerability reporting process, scope, known security properties, and audit status.

**Effort:** Low

---

### LOW-12: No module-level documentation in contract

**File:** `contracts/gene-splicer/src/lib.rs`

Missing `//!` module documentation explaining the contract's purpose, security model, and invariants.

**Recommendation:** Add a module-level doc comment.

**Effort:** Low

---

### LOW-13: Hardcoded animation timings and scales

**Files:** `src/components/CreatureRenderer.tsx:344`, `src/components/WalkingCreatures.tsx:333`

Magic numbers like `scale(0.4)`, `0.6s`, `80px` scattered throughout animation code without named constants.

**Recommendation:** Extract to named constants at the top of each file.

**Effort:** Low

---

### LOW-14: Missing ARIA labels on interactive elements

**Files:** `src/components/WalkingCreatures.tsx`, `src/components/GenomeSplicer.tsx`

Creature click handlers, battle buttons, and cartridge cards lack `aria-label` attributes.

**Recommendation:** Add ARIA labels for screen reader accessibility.

**Effort:** Low

---

## Verified Non-Issues

These items were investigated and found to be correct:

1. **BLS12-381 pairing verification** — Correctly implements `e(-sig, G2_gen) * e(H(msg), pubkey) == 1` with proper DST, subgroup checks, and G2 generator constants.
2. **G1 negation math** — Field modulus `p` is correct for BLS12-381. Big-endian subtraction with borrow handling is correct.
3. **`0x1F` mask in verify_signature_compression** — Correct for BLS12-381 compressed G1 format (3 flag bits in top of byte 0).
4. **Gene selection modulo bias** — `u32 % 10` has negligible bias (max 0.00000023%). Acceptable for game mechanics.
5. **Storage key collision** — `DataKey::Cartridge(u32)` and `DataKey::Creature(u32)` are different enum variants; Soroban serializes them distinctly.
6. **Reentrancy** — No reentrancy risk; token transfer is the only external call and state is updated after transfer.
7. **Frontrunning protection** — `splice_round = current_round + 2` provides a 6-second window against frontrunning. Sufficient for a game with 3-second drand rounds.
8. **Release profile overflow checks** — `overflow-checks = true` ensures u32 overflow panics rather than wrapping silently.

---

## Priority Implementation Order

1. **CRIT-02** + **CRIT-03**: Fix CI branch name and add tests to deploy workflow (Low effort, immediate impact)
2. **CRIT-04**: Run `npm audit fix` (Low effort)
3. **HIGH-05**: Fix NotificationProvider isVisible bug (1 character change)
4. **HIGH-01**: Gate debug routes behind env check (Low effort)
5. **HIGH-02**: Restrict CORS to splicers.net (Low effort)
6. **HIGH-06**: Throw on env parse failure in production (Low effort)
7. **HIGH-11** + **HIGH-12**: Fix hardcoded contract ID fallback and add fetch timeout (Low effort)
8. **CRIT-01**: Rewrite contract tests (High effort, critical for safety)
9. **HIGH-03** + **HIGH-04**: Add rate limiting and input validation to server (Medium effort)
10. **HIGH-10**: Consolidate contract ID management (Medium effort)
11. **MED-05**: Remove console.log from BattleArena (Low effort)
12. **MED-12**: Update CLAUDE.md to match actual contract API (Medium effort)
13. **HIGH-07**: Fix WalkingCreatures performance (High effort)
14. **HIGH-09**: Add TTL monitoring/alerting (Medium effort)
15. Everything else by severity

---

## Second Pass Review

A second full review was performed after the initial 8-pass audit. Additional findings incorporated:

- MED-03 (extend_ttl_for_contract_instance vs WASM code TTL) added
- LOW-04 (G2 PK round-trip debug artifact) added
- LOW-06 (redundant transfer verification) added
- Verified non-issues section added for investigated items that turned out to be correct

No additional issues found on second pass. Audit complete.
