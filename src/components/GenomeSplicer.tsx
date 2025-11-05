import React, { useState, useEffect } from "react";
import { Button, Card, Heading, Text } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import { useWalletBalance } from "../hooks/useWalletBalance";
import { useNotification } from "../hooks/useNotification";
import GeneSplicer from "../contracts/gene_splicer";
import { createGeneSplicerClient } from "../contracts/util";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { GenomeCartridge, Creature } from "gene_splicer";
import { CreatureRenderer } from "./CreatureRenderer";
import { BattleArena } from "./BattleArena";
import {
  fetchDrandEntropy,
  parseAndDecompressEntropy,
} from "../services/entropyRelayer";

interface GeneTrait {
  id: number;
  name: string;
  type: string;
  bodyPart: string;
  variant: number;
  rarity: string;
  folder: string;
}

interface GeneTraitsMetadata {
  version: string;
  description: string;
  genes: GeneTrait[];
}

// Constants
const POLL_INTERVAL_MS = 5000;

// Type aliases for better readability in the component
type CartridgeData = GenomeCartridge;
type CreatureData = Creature;

// Component for a single cartridge row with drand round checking
const CartridgeRow: React.FC<{
  cartridge: CartridgeData;
  onFinalized: () => void;
}> = React.memo(({ cartridge, onFinalized }) => {
  const wallet = useWallet();
  const { addNotification } = useNotification();
  const [isClicked, setIsClicked] = useState(false);

  // Check if the drand round has passed (round is available)
  // Drand quicknet: genesis = 1692803367, period = 3s
  const { data: roundAvailable } = useQuery<boolean>({
    queryKey: ["drand-round-available", String(cartridge.splice_round)],
    queryFn: (): boolean => {
      const now = Math.floor(Date.now() / 1000);
      const drandGenesis = 1692803367;
      const drandPeriod = 3;
      const currentRound = Math.floor((now - drandGenesis) / drandPeriod) + 1;
      return currentRound >= Number(cartridge.splice_round);
    },
    enabled: !cartridge.finalized,
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Finalize mutation - fetches entropy from drand and submits inline
  const finalizeMutation = useMutation<number, Error>({
    mutationFn: async (): Promise<number> => {
      if (!wallet?.address) throw new Error("Wallet not connected");
      if (!wallet?.signTransaction) throw new Error("Wallet cannot sign");

      // Fetch entropy from drand for this cartridge's round
      const drandRound = await fetchDrandEntropy(
        Number(cartridge.splice_round),
      );
      const uncompressed = parseAndDecompressEntropy(drandRound);

      // Convert Uint8Array to Buffer for contract (no hex conversion needed)
      const randomnessBuffer = Buffer.from(uncompressed.randomness);
      const signatureBuffer = Buffer.from(uncompressed.signature_uncompressed);

      // Create client with user's public key for write operations
      const client = await createGeneSplicerClient(wallet.address);
      const tx = await client.finalize_splice({
        cartridge_id: cartridge.id,
        round: BigInt(uncompressed.round),
        randomness: randomnessBuffer,
        signature: signatureBuffer,
      });

      const signed = await tx.signAndSend({
        signTransaction: wallet.signTransaction,
      });
      return Number(signed.result);
    },
    onSuccess: () => {
      // Don't reset isClicked - keep showing "Printing Creature..." until cartridge.finalized updates
      onFinalized();
    },
    onError: (error) => {
      setIsClicked(false);
      // Don't show notification for user rejection
      if (!error.message.includes("user rejected")) {
        addNotification(error.message, "error");
      }
    },
  });

  return (
    <div
      style={{
        padding: "0.75rem",
        marginBottom: "0.5rem",
        backgroundColor: "var(--cartridge-bg)",
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
        <Button size="sm" variant="secondary" disabled>
          Creature Printed
        </Button>
      ) : roundAvailable ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setIsClicked(true);
            finalizeMutation.mutate();
          }}
          disabled={finalizeMutation.isPending || isClicked}
        >
          {finalizeMutation.isPending || isClicked ? (
            <span className="sequencing-text">Printing Creature...</span>
          ) : (
            "Sequencing Complete... Print Creature"
          )}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" disabled>
          <span className="sequencing-text">Sequencing...</span>
        </Button>
      )}
    </div>
  );
});

CartridgeRow.displayName = "CartridgeRow";

export const GenomeSplicer: React.FC = () => {
  const wallet = useWallet();
  const { updateBalance } = useWalletBalance();
  const [lastMintedId, setLastMintedId] = useState<number | null>(null);
  const [geneTraits, setGeneTraits] = useState<GeneTrait[]>([]);
  const [battleCreature, setBattleCreature] = useState<CreatureData | null>(
    null,
  );

  // Load gene traits metadata
  useEffect(() => {
    fetch("/metadata/gene-traits.json")
      .then((res) => res.json())
      .then((data: GeneTraitsMetadata) => setGeneTraits(data.genes))
      .catch((err) => console.error("Failed to load gene traits:", err));
  }, []);

  // Helper to get trait name by gene ID
  const getTraitName = (geneId: number) => {
    const trait = geneTraits.find((t) => t.id === geneId % 15);
    return trait?.name || `Gene #${geneId}`;
  };

  // Calculate power level based on rarity
  const calculatePowerLevel = (creature: CreatureData) => {
    const rarityToPower: Record<string, number> = {
      common: 3,
      rare: 6,
      legendary: 10,
    };

    const headRarity = creature.head_gene.rarity.tag.toLowerCase();
    const torsoRarity = creature.torso_gene.rarity.tag.toLowerCase();
    const legsRarity = creature.legs_gene.rarity.tag.toLowerCase();

    return (
      (rarityToPower[headRarity] || 3) +
      (rarityToPower[torsoRarity] || 3) +
      (rarityToPower[legsRarity] || 3)
    );
  };

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
              backgroundColor: "var(--success-bg)",
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
                  padding: "1rem",
                  marginBottom: "1rem",
                  background:
                    "linear-gradient(135deg, var(--bg-card-gradient-start) 0%, var(--bg-card-gradient-end) 100%)",
                  borderRadius: "12px",
                  border: "2px solid var(--border-card)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "1.5rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Creature visual */}
                  <div
                    style={{
                      flex: "0 0 auto",
                      backgroundColor: "var(--creature-box-bg)",
                      borderRadius: "8px",
                      padding: "0.5rem",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      width: "200px",
                      height: "280px",
                      paddingTop: "40px",
                      overflow: "hidden",
                    }}
                  >
                    <CreatureRenderer creature={creature} />
                  </div>

                  {/* Creature info */}
                  <div style={{ flex: "1", minWidth: "250px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "1rem",
                      }}
                    >
                      <div>
                        <Text
                          as="p"
                          size="md"
                          style={{ fontWeight: "bold", marginBottom: "0.5rem" }}
                        >
                          Creature #{creature.id}
                        </Text>
                        <Text as="p" size="sm" style={{ color: "#666" }}>
                          Skin Variant: {creature.skin_id}
                        </Text>
                      </div>

                      {/* Power Level */}
                      {(() => {
                        const powerLevel = calculatePowerLevel(creature);
                        const powerPercentage = (powerLevel / 30) * 100;
                        // Color gradient from grey to red based on power level
                        const getPowerColor = (power: number) => {
                          if (power <= 12) return "#9ca3af"; // grey (weak)
                          if (power <= 18) return "#f59e0b"; // orange (medium)
                          if (power <= 24) return "#ef4444"; // red (strong)
                          return "#dc2626"; // dark red (legendary)
                        };

                        return (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: "0.25rem",
                            }}
                          >
                            <Text
                              as="p"
                              size="xs"
                              style={{
                                color: "#666",
                                fontWeight: "600",
                                marginBottom: "0.25rem",
                              }}
                            >
                              POWER LEVEL
                            </Text>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.5rem",
                              }}
                            >
                              <div
                                style={{
                                  width: "100px",
                                  height: "8px",
                                  backgroundColor: "var(--power-bar-bg)",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  border: "1px solid var(--border-gene-card)",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${powerPercentage}%`,
                                    height: "100%",
                                    backgroundColor: getPowerColor(powerLevel),
                                    transition: "width 0.3s ease",
                                  }}
                                />
                              </div>
                              <Text
                                as="p"
                                size="sm"
                                style={{
                                  color: getPowerColor(powerLevel),
                                  fontWeight: "bold",
                                  fontSize: "1.1rem",
                                  minWidth: "45px",
                                }}
                              >
                                {powerLevel}/30
                              </Text>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Gene details */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(100px, 1fr))",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "var(--gene-card-bg)",
                          borderRadius: "6px",
                          border: `2px solid ${
                            creature.head_gene.rarity.tag === "Legendary"
                              ? "#f59e0b"
                              : creature.head_gene.rarity.tag === "Rare"
                                ? "#9f7aea"
                                : "#a0aec0"
                          }`,
                        }}
                      >
                        <Text
                          as="p"
                          size="xs"
                          style={{ color: "#666", marginBottom: "0.25rem" }}
                        >
                          HEAD
                        </Text>
                        <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                          #{creature.head_gene.id}
                        </Text>
                        <Text
                          as="p"
                          size="xs"
                          style={{
                            color: "#aaa",
                            marginTop: "0.25rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {getTraitName(creature.head_gene.id)}
                        </Text>
                        <Text
                          as="p"
                          size="sm"
                          style={{
                            color:
                              creature.head_gene.rarity.tag === "Legendary"
                                ? "#f59e0b"
                                : creature.head_gene.rarity.tag === "Rare"
                                  ? "#9f7aea"
                                  : "#718096",
                            fontWeight: "600",
                          }}
                        >
                          {creature.head_gene.rarity.tag}
                        </Text>
                      </div>
                      <div
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "var(--gene-card-bg)",
                          borderRadius: "6px",
                          border: `2px solid ${
                            creature.torso_gene.rarity.tag === "Legendary"
                              ? "#f59e0b"
                              : creature.torso_gene.rarity.tag === "Rare"
                                ? "#9f7aea"
                                : "#a0aec0"
                          }`,
                        }}
                      >
                        <Text
                          as="p"
                          size="xs"
                          style={{ color: "#666", marginBottom: "0.25rem" }}
                        >
                          BODY
                        </Text>
                        <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                          #{creature.torso_gene.id}
                        </Text>
                        <Text
                          as="p"
                          size="xs"
                          style={{
                            color: "#aaa",
                            marginTop: "0.25rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {getTraitName(creature.torso_gene.id)}
                        </Text>
                        <Text
                          as="p"
                          size="sm"
                          style={{
                            color:
                              creature.torso_gene.rarity.tag === "Legendary"
                                ? "#f59e0b"
                                : creature.torso_gene.rarity.tag === "Rare"
                                  ? "#9f7aea"
                                  : "#718096",
                            fontWeight: "600",
                          }}
                        >
                          {creature.torso_gene.rarity.tag}
                        </Text>
                      </div>
                      <div
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "var(--gene-card-bg)",
                          borderRadius: "6px",
                          border: `2px solid ${
                            creature.legs_gene.rarity.tag === "Legendary"
                              ? "#f59e0b"
                              : creature.legs_gene.rarity.tag === "Rare"
                                ? "#9f7aea"
                                : "#a0aec0"
                          }`,
                        }}
                      >
                        <Text
                          as="p"
                          size="xs"
                          style={{ color: "#666", marginBottom: "0.25rem" }}
                        >
                          LEGS
                        </Text>
                        <Text as="p" size="sm" style={{ fontWeight: "bold" }}>
                          #{creature.legs_gene.id}
                        </Text>
                        <Text
                          as="p"
                          size="xs"
                          style={{
                            color: "#aaa",
                            marginTop: "0.25rem",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {getTraitName(creature.legs_gene.id)}
                        </Text>
                        <Text
                          as="p"
                          size="sm"
                          style={{
                            color:
                              creature.legs_gene.rarity.tag === "Legendary"
                                ? "#f59e0b"
                                : creature.legs_gene.rarity.tag === "Rare"
                                  ? "#9f7aea"
                                  : "#718096",
                            fontWeight: "600",
                          }}
                        >
                          {creature.legs_gene.rarity.tag}
                        </Text>
                      </div>
                    </div>

                    {/* Battle Button */}
                    <div style={{ marginTop: "1rem" }}>
                      <Button
                        size="md"
                        variant="primary"
                        onClick={() => setBattleCreature(creature)}
                        style={{
                          width: "100%",
                          fontSize: "1.2rem",
                          padding: "0.75rem",
                          background:
                            "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                          border: "3px solid #991b1b",
                          boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                        }}
                      >
                        ⚔️ BATTLE!
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Battle Arena Overlay */}
      {battleCreature && (
        <BattleArena
          playerCreature={battleCreature}
          onExit={() => setBattleCreature(null)}
        />
      )}
    </div>
  );
};
