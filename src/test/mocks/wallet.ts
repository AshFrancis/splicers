import { vi } from "vitest";

export const mockWalletAddress =
  "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI";

export const mockWallet = {
  address: mockWalletAddress,
  network: "LOCAL",
  signTransaction: vi.fn(),
  signAuthEntry: vi.fn(),
  signMessage: vi.fn(),
};

export const mockWalletBalance = {
  balance: "100.0000000",
  updateBalance: vi.fn(),
  isLoading: false,
  error: null,
};

export function createMockSignTransaction() {
  return vi.fn((xdr: string) => {
    // Mock a signed transaction
    return Promise.resolve(xdr);
  });
}
