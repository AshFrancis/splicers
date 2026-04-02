import { describe, it, expect } from "vitest";
import { calculatePower } from "./creature";
import type { Creature } from "gene_splicer";

type RarityTag = "Normal" | "Rare" | "Legendary";

function mockCreature(
  headRarity: RarityTag,
  bodyRarity: RarityTag,
  legsRarity: RarityTag,
): Creature {
  return {
    id: 1,
    owner: "GABCDEF",
    skin_id: 0,
    head_gene: {
      id: 0,
      rarity: { tag: headRarity, values: undefined as never },
    },
    body_gene: {
      id: 0,
      rarity: { tag: bodyRarity, values: undefined as never },
    },
    legs_gene: {
      id: 0,
      rarity: { tag: legsRarity, values: undefined as never },
    },
    finalized_at: BigInt(0),
    entropy_round: BigInt(0),
  };
}

describe("calculatePower", () => {
  it("calculates power for all Normal genes", () => {
    expect(calculatePower(mockCreature("Normal", "Normal", "Normal"))).toBe(9);
  });

  it("calculates power for all Legendary genes", () => {
    expect(
      calculatePower(mockCreature("Legendary", "Legendary", "Legendary")),
    ).toBe(30);
  });

  it("calculates power for mixed rarities", () => {
    expect(calculatePower(mockCreature("Normal", "Rare", "Legendary"))).toBe(
      19,
    ); // 3 + 6 + 10
  });

  it("calculates power for all Rare genes", () => {
    expect(calculatePower(mockCreature("Rare", "Rare", "Rare"))).toBe(18);
  });
});
