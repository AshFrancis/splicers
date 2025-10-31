import React, { useState } from "react";
import { Button, Card, Heading, Text } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import * as GeneSplicer from "../contracts/gene_splicer";
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
  const [lastMintedId, setLastMintedId] = useState<number | null>(null);

  // Query user's cartridges
  const { data: cartridges, refetch: refetchCartridges } = useQuery<number[]>({
    queryKey: ["user-cartridges", wallet?.address],
    queryFn: async (): Promise<number[]> => {
      if (!wallet?.address) return [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const ids = (await GeneSplicer.get_user_cartridges({
          user: wallet.address,
        })) as unknown as number[];
        return ids;
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return (await GeneSplicer.get_cartridge({
          cartridge_id: lastMintedId,
        })) as unknown as CartridgeData;
      } catch {
        return null;
      }
    },
    enabled: !!lastMintedId,
  });

  // Mutation for minting
  const mintMutation = useMutation<{ result: unknown }, Error>({
    mutationFn: async (): Promise<{ result: unknown }> => {
      if (!wallet?.address) throw new Error("Wallet not connected");

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = (await GeneSplicer.splice_genome(
        {
          user: wallet.address,
        },
        {
          responseType: "full",
        },
      )) as unknown as { result: unknown };

      return result;
    },
    onSuccess: (data) => {
      // Extract cartridge ID from result
      const cartridgeId = data.result as number;
      setLastMintedId(Number(cartridgeId));
      void refetchCartridges();
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
