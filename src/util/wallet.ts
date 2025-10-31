import storage from "./storage";
import {
  ISupportedWallet,
  StellarWalletsKit,
  WalletNetwork,
  sep43Modules,
} from "@creit.tech/stellar-wallets-kit";
import { Horizon } from "@stellar/stellar-sdk";
import { networkPassphrase, stellarNetwork } from "../contracts/util";

const kit: StellarWalletsKit = new StellarWalletsKit({
  network: networkPassphrase as WalletNetwork,
  modules: sep43Modules(),
});

export const connectWallet = async () => {
  await kit.openModal({
    modalTitle: "Connect to your wallet",
    onWalletSelected: (option: ISupportedWallet) => {
      const selectedId = option.id;
      kit.setWallet(selectedId);

      // Wrap async logic in void to satisfy type signature
      void (async () => {
        try {
          // Request access first
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await kit.requestAccess();

          // Now we can get the address
          const address = await kit.getAddress();

          if (address.address) {
            storage.setItem("walletId", selectedId);
            storage.setItem("walletAddress", address.address);
          } else {
            storage.setItem("walletId", "");
            storage.setItem("walletAddress", "");
          }

          // Get network info for compatible wallets
          if (selectedId == "freighter" || selectedId == "hot-wallet") {
            const network = await kit.getNetwork();
            if (network.network && network.networkPassphrase) {
              storage.setItem("walletNetwork", network.network);
              storage.setItem("networkPassphrase", network.networkPassphrase);
            } else {
              storage.setItem("walletNetwork", "");
              storage.setItem("networkPassphrase", "");
            }
          }
        } catch (err) {
          console.error(
            "Wallet connection error:",
            err instanceof Error ? err.message : String(err),
          );
          storage.setItem("walletId", "");
          storage.setItem("walletAddress", "");
        }
      })();
    },
  });
};

export const disconnectWallet = async () => {
  await kit.disconnect();
  storage.removeItem("walletId");
};

function getHorizonHost(mode: string) {
  switch (mode) {
    case "LOCAL":
      return "http://localhost:8000";
    case "FUTURENET":
      return "https://horizon-futurenet.stellar.org";
    case "TESTNET":
      return "https://horizon-testnet.stellar.org";
    case "PUBLIC":
      return "https://horizon.stellar.org";
    default:
      throw new Error(`Unknown Stellar network: ${mode}`);
  }
}

export const fetchBalance = async (address: string) => {
  const horizon = new Horizon.Server(getHorizonHost(stellarNetwork), {
    allowHttp: stellarNetwork === "LOCAL",
  });

  const { balances } = await horizon.accounts().accountId(address).call();
  return balances;
};

export type Balance = Awaited<ReturnType<typeof fetchBalance>>[number];

export const wallet = kit;
