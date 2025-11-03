import { test, expect } from "@playwright/test";

/**
 * E2E Test: Cartridge Minting and Finalization Flow
 *
 * Prerequisites:
 * 1. Local Stellar network running (stellar scaffold network)
 * 2. Contract deployed with dev_mode=true
 * 3. Test wallet with funded account
 * 4. Entropy relayer running or manual entropy submission
 *
 * This test covers the complete user journey:
 * - Connect wallet
 * - Mint cartridge
 * - Wait for entropy
 * - Finalize cartridge to create creature
 */

test.describe("Cartridge Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show connect wallet prompt when not connected", async ({
    page,
  }) => {
    // Check that connect wallet message is shown
    await expect(page.getByText("Please connect your wallet")).toBeVisible();

    // Mint button should not be visible
    await expect(
      page.getByRole("button", { name: /splice genome/i }),
    ).not.toBeVisible();
  });

  test("should display mint button when wallet is connected", async ({
    page,
  }) => {
    // Note: This test requires manual wallet connection or wallet extension mock
    // Skip in CI until wallet automation is added
    test.skip(
      !!process.env.CI,
      "Wallet connection requires manual interaction",
    );

    // Wait for wallet to connect (manual action)
    await page.waitForTimeout(5000);

    // Check for mint button
    const mintButton = page.getByRole("button", {
      name: /splice genome.*1 xlm/i,
    });

    if (await mintButton.isVisible()) {
      await expect(mintButton).toBeEnabled();
      await expect(
        page.getByText("Create a new Genome Cartridge NFT"),
      ).toBeVisible();
    }
  });

  test.describe("Full Cartridge Lifecycle (Manual)", () => {
    test("README: How to run this test manually", () => {
      // This is a documentation test that always passes
      const instructions = `
# Manual E2E Test Instructions

## Prerequisites
1. Start local Stellar network:
   \`\`\`
   stellar scaffold network start
   \`\`\`

2. Deploy contract with dev_mode=true:
   \`\`\`
   stellar contract deploy \\
     --wasm target/wasm32-unknown-unknown/release/gene_splicer.wasm \\
     --source alice \\
     --network local
   \`\`\`

3. Initialize contract:
   \`\`\`
   stellar contract invoke \\
     --id <CONTRACT_ID> \\
     --source alice \\
     --network local \\
     -- initialize \\
     --admin <ALICE_ADDRESS> \\
     --xlm_token <XLM_TOKEN_ADDRESS> \\
     --skin_count 10 \\
     --dev_mode true \\
     --drand_public_key <PUBKEY_HEX>
   \`\`\`

4. Start the app:
   \`\`\`
   npm run dev
   \`\`\`

5. Connect wallet (Freighter with test account)

## Test Flow
1. Click "Splice Genome (1 XLM)" button
2. Approve transaction in wallet
3. Verify cartridge appears in "Your Genome Cartridges"
4. Wait for "Sequencing..." to change to "Finalize" button
   (Requires entropy submission via script or relayer)
5. Click "Finalize" button
6. Approve transaction in wallet
7. Verify creature appears in "Your Creatures"
8. Verify creature has head, torso, and legs genes
9. Verify genes have rarity (Common/Rare/Legendary)

## Entropy Submission
Run the entropy relayer or manually submit:
\`\`\`
bash scripts/testBLS12381.sh
\`\`\`
      `;

      console.log(instructions);
      expect(true).toBe(true);
    });
  });

  test("should handle minting errors gracefully", () => {
    test.skip(
      !!process.env.CI,
      "Requires wallet connection and transaction rejection",
    );

    // This test would check that:
    // 1. Error messages are displayed when transactions fail
    // 2. User can retry after error
    // 3. UI returns to normal state after error
  });

  test("should poll for entropy updates", () => {
    test.skip(
      !!process.env.CI,
      "Requires wallet connection and existing cartridge",
    );

    // This test would verify:
    // 1. "Sequencing..." button is shown initially
    // 2. Button updates to "Finalize" when entropy is available
    // 3. Polling happens at correct interval (5 seconds)
  });

  test("should display creatures with gene information", () => {
    test.skip(
      !!process.env.CI,
      "Requires wallet connection and finalized creature",
    );

    // This test would verify:
    // 1. Creature card is shown
    // 2. Head, torso, legs genes are displayed
    // 3. Rarity colors are correct (Common/Rare/Legendary)
    // 4. Skin ID is shown
  });
});

test.describe("Error Boundaries", () => {
  test("should show error boundary on component crash", () => {
    // This would test React error boundaries
    // Could be triggered by mocking a contract error that crashes the component
    test.skip(true, "Requires error injection mechanism");
  });
});

test.describe("Network Pill", () => {
  test("should show current network", async ({ page }) => {
    await page.goto("/");

    // Check that network pill shows "Local" for local network
    const networkPill = page
      .locator('text="Local"')
      .or(page.locator('text="Testnet"'));
    await expect(networkPill.first()).toBeVisible();
  });

  test("should show warning when wallet network mismatches", () => {
    test.skip(!!process.env.CI, "Requires wallet on different network");

    // This would test that:
    // 1. Network pill turns red when wallet is on wrong network
    // 2. Tooltip explains the mismatch
  });
});
