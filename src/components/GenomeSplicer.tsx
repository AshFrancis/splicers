import React, { useState, useMemo } from "react";
import { Button, Card, Heading, Text } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { Client } from "gene_splicer";
import { rpcUrl } from "../contracts/util";
import { useMutation, useQuery } from "@tanstack/react-query";

interface CartridgeData {
  id: number;
  owner: string;
  skin_id: number;
  splice_round: bigint;
  created_at: bigint;
}

export const GenomeSplicer: React.FC = () => {
  const wallet = useWallet();
  const { updateBalance } = useWalletBalance();
  const [lastMintedId, setLastMintedId] = useState<number | null>(null);

  // Create contract client with wallet's public key
  const geneSplicer = useMemo(
    () =>
      new Client({
        networkPassphrase: "Standalone Network ; February 2017",
        contractId: "CDIQSBTIKKMJSD3ITTYOHMF7FYIIUQE4VO7HZJTS2CQS5K7PYHRB2L76",
        rpcUrl,
        allowHttp: true,
        publicKey: wallet?.address,
      }),
    [wallet?.address],
  );

  // Query user's cartridges
  const { data: cartridges, refetch: refetchCartridges } = useQuery<number[]>({
    queryKey: ["user-cartridges", wallet?.address],
    queryFn: async (): Promise<number[]> => {
      if (!wallet?.address) return [];
      try {
        const tx = await geneSplicer.get_user_cartridges({
          user: wallet.address,
        });
        const result = await tx.simulate();
        return result.result ?? [];
      } catch {
        return [];
      }
    },

    enabled: !!wallet?.address,
  });

  // Query cartridge details
  const { data: cartridgeDetails } = useQuery<CartridgeData | null>({
    queryKey: ["cartridge", lastMintedId],
    queryFn: async (): Promise<CartridgeData | null> => {
      if (!lastMintedId) return null;
      try {
        const tx = await geneSplicer.get_cartridge({
          cartridge_id: lastMintedId,
        });
        const result = await tx.simulate();
        return (result.result ?? null) as CartridgeData | null;
      } catch {
        return null;
      }
    },
    enabled: !!lastMintedId,
  });

  // Mutation for minting
  const mintMutation = useMutation<number, Error>({
    mutationFn: async (): Promise<number> => {
      if (!wallet?.address) throw new Error("Wallet not connected");
      if (!wallet?.signTransaction) throw new Error("Wallet cannot sign");

      const tx = await geneSplicer.splice_genome({
        user: wallet.address,
      });

      const signed = await tx.signAndSend({
        signTransaction: wallet.signTransaction,
      });
      return Number(signed.result);
    },
    onSuccess: (cartridgeId) => {
      setLastMintedId(cartridgeId);
      void refetchCartridges();
      void updateBalance(); // Refresh wallet balance after successful mint
    },
  });

  if (!wallet?.address) {
    return (
      <Card>
        <Heading as="h3" size="sm">
          Genome Cartridge Minting
        </Heading>
        <Text as="p" size="sm">
          Please connect your wallet to mint genome cartridges.
        </Text>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Card>
        <Heading as="h3" size="sm">
          Mint Genome Cartridge
        </Heading>
        <Text as="p" size="sm">
          Create a new Genome Cartridge NFT with a random skin. Cost: 1 XLM
        </Text>

        <div style={{ marginTop: "1rem" }}>
          <Button
            size="md"
            variant="primary"
            onClick={() => mintMutation.mutate()}
            disabled={mintMutation.isPending}
          >
            {mintMutation.isPending ? "Minting..." : "Splice Genome (1 XLM)"}
          </Button>
        </div>

        {mintMutation.isError && (
          <Text as="p" size="sm" style={{ color: "red", marginTop: "0.5rem" }}>
            Error:{" "}
            {mintMutation.error instanceof Error
              ? mintMutation.error.message
              : "Failed to mint"}
          </Text>
        )}

        {mintMutation.isSuccess && lastMintedId && (
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              backgroundColor: "#e8f5e9",
              borderRadius: "4px",
            }}
          >
            <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
              ✓ Cartridge Minted! ID: {lastMintedId}
            </Text>
            {cartridgeDetails && (
              <div style={{ marginTop: "0.5rem" }}>
                <Text as="p" size="sm">
                  Skin ID: {cartridgeDetails.skin_id}
                </Text>
                <Text as="p" size="sm">
                  Splice Round: {String(cartridgeDetails.splice_round)}
                </Text>
              </div>
            )}
          </div>
        )}
      </Card>

      {cartridges && cartridges.length > 0 && (
        <Card>
          <Heading as="h3" size="sm">
            Your Genome Cartridges ({cartridges.length})
          </Heading>
          <div style={{ marginTop: "0.5rem" }}>
            {cartridges.map((id: number) => (
              <div
                key={id}
                style={{
                  padding: "0.5rem",
                  marginBottom: "0.5rem",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                }}
              >
                <Text as="p" size="sm">
                  Cartridge #{id}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
