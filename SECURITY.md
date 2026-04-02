# Security Policy

## Reporting a Vulnerability

Please report vulnerabilities via [GitHub Security Advisories](https://github.com/AshFrancis/splicers/security/advisories/new).

Do **not** open public issues for security vulnerabilities.

## Scope

The following components are security-critical:

- **Smart contract** (`contracts/gene-splicer/src/lib.rs`): BLS12-381 signature verification, XLM fee handling, gene selection fairness
- **Backend server** (`server/`): Funded wallet for keep-alive transactions, Pinata API credentials
- **Environment configuration** (`.env`, GitHub Secrets): Secret keys, contract IDs

The following are **not** security-critical:

- **Frontend BLS point decompression** (`src/services/entropyRelayer.ts`): All cryptographic verification happens on-chain; the frontend only decompresses points for submission
- **Gene rendering / battle logic**: Client-side cosmetics with no on-chain impact

## Security Properties

1. **BLS12-381 pairing verification** is performed entirely on-chain (CAP-0059). The off-chain relayer cannot forge entropy.
2. **Frontrunning protection**: Cartridges are assigned a future drand round at mint time. Users cannot predict entropy when minting.
3. **Replay protection**: Each cartridge can only be finalized once. The assigned drand round is enforced.
4. **Subgroup safety**: All BLS12-381 points are checked for subgroup membership before use.
5. **TTL management**: Contract instance and persistent storage are TTL-extended on every interaction and by a daily keep-alive service.
