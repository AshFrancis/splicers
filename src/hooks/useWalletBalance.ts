import { useWallet } from "./useWallet";
import type { Balance } from "../util/wallet";

type WalletBalance = {
  balances: Balance[];
  xlm: string;
  isFunded: boolean;
  isLoading: boolean;
  error: Error | null;
  updateBalance: () => Promise<void>;
};

export const useWalletBalance = (): WalletBalance => {
  const {
    balances,
    xlm,
    isFunded,
    isLoadingBalance,
    balanceError,
    updateBalance,
  } = useWallet();

  return {
    balances,
    xlm,
    isFunded,
    isLoading: isLoadingBalance,
    error: balanceError,
    updateBalance,
  };
};
