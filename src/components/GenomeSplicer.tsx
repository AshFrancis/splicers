import React, { useState } from "react";
import { Button, Card, Heading, Text } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useWalletBalance } from "../hooks/useWalletBalance";
import GeneSplicer from "../contracts/gene_splicer";
import { createGeneSplicerClient } from "../contracts/util";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { GenomeCartridge, Creature } from "gene_splicer";

// Constants
const POLL_INTERVAL_MS = 5000;

// Type aliases for better readability in the component
type CartridgeData = GenomeCartridge;
type CreatureData = Creature;

// Component for a single cartridge row with entropy checking
const CartridgeRow: React.FC<{
  cartridge: CartridgeData;
  onFinalized: () => void;
}> = React.memo(({ cartridge, onFinalized }) => {
  const wallet = useWallet();

  // Check if entropy is available for this cartridge's splice round
  const { data: entropyAvailable } = useQuery<boolean>({
    queryKey: ["entropy-available", String(cartridge.splice_round)],
    queryFn: async (): Promise<boolean> => {
      try {
        const tx = await GeneSplicer.get_entropy({
          round: cartridge.splice_round,
        });
        const result = await tx.simulate();
        return result.result !== null && result.result !== undefined;
      } catch {
        return false;
      }
    },
    enabled: !cartridge.finalized,
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Finalize mutation
  const finalizeMutation = useMutation<number, Error>({
    mutationFn: async (): Promise<number> => {
      if (!wallet?.address) throw new Error("Wallet not connected");
      if (!wallet?.signTransaction) throw new Error("Wallet cannot sign");

      // Create client with user's public key for write operations
      const client = await createGeneSplicerClient(wallet.address);
      const tx = await client.finalize_splice({
        cartridge_id: cartridge.id,
      });

      const signed = await tx.signAndSend({
        signTransaction: wallet.signTransaction,
      });
      return Number(signed.result);
    },
    onSuccess: () => {
      onFinalized();
    },
  });

  return (
    <div
      style={{
        padding: "0.75rem",
        marginBottom: "0.5rem",
        backgroundColor: "#f5f5f5",
        borderRadius: "4px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
          Cartridge #{cartridge.id}
        </Text>
        <Text as="p" size="sm" style={{ color: "#666" }}>
          Skin ID: {cartridge.skin_id}
        </Text>
      </div>

      {cartridge.finalized ? (
        <Text as="p" size="sm" style={{ color: "green", fontWeight: "bold" }}>
          ✓ Finalized
        </Text>
      ) : entropyAvailable ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => finalizeMutation.mutate()}
          disabled={finalizeMutation.isPending}
        >
          {finalizeMutation.isPending ? "Finalizing..." : "Finalize"}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" disabled>
          <span
            style={{
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            Sequencing...
          </span>
        </Button>
      )}

      {finalizeMutation.isError && (
        <Text as="p" size="sm" style={{ color: "red", marginLeft: "0.5rem" }}>
          Error: {finalizeMutation.error.message}
        </Text>
      )}
    </div>
  );
});

CartridgeRow.displayName = "CartridgeRow";

export const GenomeSplicer: React.FC = () => {
  const wallet = useWallet();
  const { updateBalance } = useWalletBalance();
  const [lastMintedId, setLastMintedId] = useState<number | null>(null);

  // Query user's cartridges with full details
  const { data: cartridges, refetch: refetchCartridges } = useQuery<
    CartridgeData[]
  >({
    queryKey: ["user-cartridges", wallet?.address],
    queryFn: async (): Promise<CartridgeData[]> => {
      if (!wallet?.address) return [];
      try {
        const tx = await GeneSplicer.get_user_cartridges({
          user: wallet.address,
        });
        const result = await tx.simulate();
        const cartridgeIds = result.result ?? [];

        // Fetch full details for each cartridge
        const cartridgeDetails = await Promise.all(
          cartridgeIds.map(async (id) => {
            try {
              const detailTx = await GeneSplicer.get_cartridge({
                cartridge_id: id,
              });
              const detailResult = await detailTx.simulate();
              return detailResult.result as CartridgeData | null;
            } catch (err) {
              console.error(`Failed to fetch cartridge ${id}:`, err);
              return null;
            }
          }),
        );

        return cartridgeDetails.filter(
          (c): c is CartridgeData => c !== null && c !== undefined,
        );
      } catch (err) {
        console.error("Failed to fetch cartridges:", err);
        return [];
      }
    },

    enabled: !!wallet?.address,
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Query user's creatures with full details
  const { data: creatures } = useQuery<CreatureData[]>({
    queryKey: ["user-creatures", wallet?.address],
    queryFn: async (): Promise<CreatureData[]> => {
      if (!wallet?.address) return [];
      try {
        const tx = await GeneSplicer.get_user_creatures({
          user: wallet.address,
        });
        const result = await tx.simulate();
        const creatureIds = result.result ?? [];

        // Fetch full details for each creature
        const creatureDetails = await Promise.all(
          creatureIds.map(async (id) => {
            try {
              const detailTx = await GeneSplicer.get_creature({
                creature_id: id,
              });
              const detailResult = await detailTx.simulate();
              return detailResult.result as CreatureData | null;
            } catch (err) {
              console.error(`Failed to fetch creature ${id}:`, err);
              return null;
            }
          }),
        );

        return creatureDetails.filter(
          (c): c is CreatureData => c !== null && c !== undefined,
        );
      } catch (err) {
        console.error("Failed to fetch creatures:", err);
        return [];
      }
    },

    enabled: !!wallet?.address,
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Query cartridge details
  const { data: cartridgeDetails } = useQuery<CartridgeData | null>({
    queryKey: ["cartridge", lastMintedId],
    queryFn: async (): Promise<CartridgeData | null> => {
      if (!lastMintedId) return null;
      try {
        const tx = await GeneSplicer.get_cartridge({
          cartridge_id: lastMintedId,
        });
        const result = await tx.simulate();
        return result.result ?? null;
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

      // Create client with user's public key for write operations
      const client = await createGeneSplicerClient(wallet.address);
      const tx = await client.splice_genome({
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
            {cartridges.map((cartridge) => (
              <CartridgeRow
                key={cartridge.id}
                cartridge={cartridge}
                onFinalized={() => void refetchCartridges()}
              />
            ))}
          </div>
        </Card>
      )}

      {creatures && creatures.length > 0 && (
        <Card>
          <Heading as="h3" size="sm">
            Your Creatures ({creatures.length})
          </Heading>
          <div style={{ marginTop: "0.5rem" }}>
            {creatures.map((creature) => (
              <div
                key={creature.id}
                style={{
                  padding: "0.75rem",
                  marginBottom: "0.5rem",
                  backgroundColor: "#e8f5e9",
                  borderRadius: "4px",
                }}
              >
                <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                  Creature #{creature.id}
                </Text>
                <Text as="p" size="sm" style={{ color: "#666" }}>
                  Skin ID: {creature.skin_id}
                </Text>
                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      padding: "0.5rem",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                      Head #{creature.head_gene.id}
                    </Text>
                    <Text
                      as="p"
                      size="sm"
                      style={{
                        color:
                          creature.head_gene.rarity.tag === "Legendary"
                            ? "#ff9800"
                            : creature.head_gene.rarity.tag === "Rare"
                              ? "#9c27b0"
                              : "#666",
                      }}
                    >
                      {creature.head_gene.rarity.tag}
                    </Text>
                  </div>
                  <div
                    style={{
                      padding: "0.5rem",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                      Torso #{creature.torso_gene.id}
                    </Text>
                    <Text
                      as="p"
                      size="sm"
                      style={{
                        color:
                          creature.torso_gene.rarity.tag === "Legendary"
                            ? "#ff9800"
                            : creature.torso_gene.rarity.tag === "Rare"
                              ? "#9c27b0"
                              : "#666",
                      }}
                    >
                      {creature.torso_gene.rarity.tag}
                    </Text>
                  </div>
                  <div
                    style={{
                      padding: "0.5rem",
                      backgroundColor: "white",
                      borderRadius: "4px",
                    }}
                  >
                    <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                      Legs #{creature.legs_gene.id}
                    </Text>
                    <Text
                      as="p"
                      size="sm"
                      style={{
                        color:
                          creature.legs_gene.rarity.tag === "Legendary"
                            ? "#ff9800"
                            : creature.legs_gene.rarity.tag === "Rare"
                              ? "#9c27b0"
                              : "#666",
                      }}
                    >
                      {creature.legs_gene.rarity.tag}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
