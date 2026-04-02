import type { Creature } from "gene_splicer";

const RARITY_POWER: Record<string, number> = {
  normal: 3,
  rare: 6,
  legendary: 10,
};

/** Calculate total power level from a creature's gene rarities (9-30) */
export function calculatePower(creature: Creature): number {
  return (
    (RARITY_POWER[creature.head_gene.rarity.tag.toLowerCase()] || 3) +
    (RARITY_POWER[creature.body_gene.rarity.tag.toLowerCase()] || 3) +
    (RARITY_POWER[creature.legs_gene.rarity.tag.toLowerCase()] || 3)
  );
}
