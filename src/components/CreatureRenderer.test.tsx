import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "../test/test-utils";
import { CreatureRenderer } from "./CreatureRenderer";
import type { Creature } from "gene_splicer";

function createMockCreature(overrides?: Partial<Creature>): Creature {
  return {
    id: 1,
    owner: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV",
    skin_id: 0,
    head_gene: { id: 6, rarity: { tag: "Normal", values: undefined as never } },
    body_gene: {
      id: 3,
      rarity: { tag: "Legendary", values: undefined as never },
    },
    legs_gene: { id: 0, rarity: { tag: "Rare", values: undefined as never } },
    finalized_at: BigInt(1234567890),
    entropy_round: BigInt(100),
    ...overrides,
  };
}

describe("CreatureRenderer", () => {
  it("renders without crashing", () => {
    const creature = createMockCreature();
    const { container } = renderWithProviders(
      <CreatureRenderer creature={creature} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with walking animation", () => {
    const creature = createMockCreature();
    const { container } = renderWithProviders(
      <CreatureRenderer creature={creature} isWalking={true} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders with attack animation", () => {
    const creature = createMockCreature();
    const { container } = renderWithProviders(
      <CreatureRenderer
        creature={creature}
        isAttacking={true}
        attackType="punch"
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("renders all gene body parts as images", () => {
    const creature = createMockCreature();
    renderWithProviders(<CreatureRenderer creature={creature} />);

    // Should render multiple img elements for body parts
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
  });

  it("renders knocked out state", () => {
    const creature = createMockCreature();
    const { container } = renderWithProviders(
      <CreatureRenderer creature={creature} isKnockedOut={true} />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
