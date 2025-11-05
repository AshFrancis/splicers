import { vi } from "vitest";
import type { GenomeCartridge, Creature, Gene } from "gene_splicer";

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

export function createMockGene(overrides?: Partial<Gene>): Gene {
  return {
    id: 3,
    rarity: { tag: "Normal", values: undefined },
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
    head_gene: createMockGene({ id: 2 }),
    torso_gene: createMockGene({ id: 4 }),
    legs_gene: createMockGene({
      id: 7,
      rarity: { tag: "Rare", values: undefined },
    }),
    ...overrides,
  };
}

// Mock contract client
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
    get_user_creatures: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: [1] }),
    }),
    get_creature: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: createMockCreature() }),
    }),
    get_entropy: vi.fn().mockResolvedValue({
      simulate: vi.fn().mockResolvedValue({ result: null }),
    }),
  };
}

// Mock GeneSplicer default export
export const mockGeneSplicerClient = createMockContractClient();
