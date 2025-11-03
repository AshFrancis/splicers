# Testing Infrastructure

## Overview

This project has a comprehensive testing setup covering contract tests, unit tests, and E2E tests.

## Test Stack

- **Vitest**: Unit and integration testing framework
- **React Testing Library**: Component testing utilities
- **Happy DOM**: Fast DOM environment for tests
- **Playwright**: E2E testing (see e2e/ directory)

## Running Tests

```bash
# Unit/Integration Tests
npm test              # Run all unit tests
npm run test:watch    # Watch mode
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report

# E2E Tests
npm run test:e2e       # Run Playwright tests
npm run test:e2e:ui    # Playwright UI
npm run test:e2e:debug # Debug mode
```

## Test Structure

### Contract Tests (Rust)

- **Location**: `contracts/gene-splicer/src/test.rs`
- **Coverage**: Full contract functionality including BLS verification
- **Run**: `cargo test` in contract directory

### Unit/Integration Tests (TypeScript)

- **Location**: `src/**/*.test.{ts,tsx}`
- **Setup**: `src/test/setup.ts`
- **Utilities**: `src/test/test-utils.tsx`
- **Mocks**: `src/test/mocks/`

### E2E Tests (Playwright)

- **Location**: `e2e/`
- **Coverage**: Full user flows on local Stellar network
- **Prerequisites**:
  - Local Stellar network running
  - Contract deployed with dev_mode=true
  - Test wallet with funded account
- **Manual Testing**: See instructions in `e2e/cartridge-lifecycle.spec.ts`

## Test Utilities

### renderWithProviders

Renders React components with all necessary providers (React Query, Router):

```typescript
import { renderWithProviders, screen } from "../test/test-utils";

test("renders component", () => {
  renderWithProviders(<MyComponent />);
  expect(screen.getByText("Hello")).toBeInTheDocument();
});
```

### Mock Helpers

- `src/test/mocks/wallet.ts` - Wallet mocking utilities
- `src/test/mocks/contract.ts` - Contract client mocks

## Known Issues

Component tests for React 19 with Stellar Design System need additional configuration.
E2E tests with Playwright are the recommended approach for integration testing.

## Coverage

Vitest coverage excludes:

- `node_modules/`
- `src/debug/` (scaffold code)
- Config files
- Test snapshots

Target: 70%+ coverage for custom code (excluding scaffold)
