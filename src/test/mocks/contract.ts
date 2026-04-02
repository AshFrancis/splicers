import { vi } from "vitest";
import type { GenomeCartridge, Creature, Gene } from "gene_splicer";

export function createMockGene(overrides?: Partial<Gene>): Gene {
  return {
    id: 6,
    rarity: { tag: "Normal", values: undefined as never },
    ...overrides,
  };
}

export function createMockCartridge(
  overrides?: Partial<GenomeCartridge>,
): GenomeCartridge {
  return {
    id: 1,
    owner: "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI",
    skin_id: 5,
    splice_round: 12345n,
    finalized: false,
    created_at: BigInt(Date.now()),
    ...overrides,
  };
}

export function createMockCreature(overrides?: Partial<Creature>): Creature {
  return {
    id: 1,
    owner: "GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI",
    skin_id: 5,
    entropy_round: 12345n,
    finalized_at: BigInt(Date.now()),
    head_gene: createMockGene({
      id: 2,
      rarity: { tag: "Rare", values: undefined as never },
    }),
    body_gene: createMockGene({
      id: 4,
      rarity: { tag: "Legendary", values: undefined as never },
    }),
    legs_gene: createMockGene({ id: 7 }),
    ...overrides,
  };
}

export function createMockContractClient() {
  return {
    splice_genome: vi.fn().mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({ result: 1 }),
    }),
    finalize_splice: vi.fn().mockResolvedValue({
      signAndSend: vi.fn().mockResolvedValue({ result: 1 }),
    }),
    get_cartridge: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: createMockCartridge() }),
    }),
    get_user_cartridges: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: [1] }),
    }),
    get_cartridges_batch: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: [createMockCartridge()] }),
    }),
    get_user_creatures: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: [1] }),
    }),
    get_creature: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: createMockCreature() }),
    }),
    get_creatures_batch: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: [createMockCreature()] }),
    }),
    extend_ttl: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({}),
    }),
  };
}
