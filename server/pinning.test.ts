import { describe, it, expect } from "bun:test";

// Test the gene mapping logic directly (doesn't need Pinata)
function getGeneRarity(geneId: number): string {
  if (geneId >= 3 && geneId <= 5) return "Legendary";
  if (geneId >= 0 && geneId <= 2) return "Rare";
  return "Normal";
}

function getGeneType(geneId: number): string {
  if (geneId >= 3 && geneId <= 5) return "Golem";
  if (geneId >= 0 && geneId <= 2) return "Dark Oracle";
  if (geneId >= 6 && geneId <= 8) return "Necromancer";
  if (geneId >= 9 && geneId <= 11) return "Skeleton Crusader";
  return "Skeleton Warrior";
}

describe("Gene Rarity Mapping", () => {
  it("maps gene IDs 0-2 to Rare", () => {
    expect(getGeneRarity(0)).toBe("Rare");
    expect(getGeneRarity(1)).toBe("Rare");
    expect(getGeneRarity(2)).toBe("Rare");
  });

  it("maps gene IDs 3-5 to Legendary", () => {
    expect(getGeneRarity(3)).toBe("Legendary");
    expect(getGeneRarity(4)).toBe("Legendary");
    expect(getGeneRarity(5)).toBe("Legendary");
  });

  it("maps gene IDs 6-14 to Normal", () => {
    for (let i = 6; i <= 14; i++) {
      expect(getGeneRarity(i)).toBe("Normal");
    }
  });
});

describe("Gene Type Mapping", () => {
  it("maps Dark Oracle (0-2)", () => {
    expect(getGeneType(0)).toBe("Dark Oracle");
    expect(getGeneType(1)).toBe("Dark Oracle");
    expect(getGeneType(2)).toBe("Dark Oracle");
  });

  it("maps Golem (3-5)", () => {
    expect(getGeneType(3)).toBe("Golem");
    expect(getGeneType(4)).toBe("Golem");
    expect(getGeneType(5)).toBe("Golem");
  });

  it("maps Necromancer (6-8)", () => {
    expect(getGeneType(6)).toBe("Necromancer");
    expect(getGeneType(7)).toBe("Necromancer");
    expect(getGeneType(8)).toBe("Necromancer");
  });

  it("maps Skeleton Crusader (9-11)", () => {
    expect(getGeneType(9)).toBe("Skeleton Crusader");
    expect(getGeneType(10)).toBe("Skeleton Crusader");
    expect(getGeneType(11)).toBe("Skeleton Crusader");
  });

  it("maps Skeleton Warrior (12-14)", () => {
    expect(getGeneType(12)).toBe("Skeleton Warrior");
    expect(getGeneType(13)).toBe("Skeleton Warrior");
    expect(getGeneType(14)).toBe("Skeleton Warrior");
  });
});

describe("Input Validation", () => {
  // Re-implement the validation logic from index.ts for testing
  function validatePinInput(body: unknown): { valid: boolean; error?: string } {
    if (typeof body !== "object" || body === null) {
      return { valid: false, error: "Request body must be a JSON object" };
    }
    const { creatureId, headGeneId, bodyGeneId, legsGeneId, skinId } =
      body as Record<string, unknown>;
    for (const [name, value] of Object.entries({
      creatureId,
      headGeneId,
      bodyGeneId,
      legsGeneId,
      skinId,
    })) {
      if (value === undefined || value === null) {
        return { valid: false, error: `Missing required field: ${name}` };
      }
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        return {
          valid: false,
          error: `${name} must be a non-negative integer`,
        };
      }
    }
    const geneIds = {
      headGeneId: headGeneId as number,
      bodyGeneId: bodyGeneId as number,
      legsGeneId: legsGeneId as number,
    };
    for (const [name, value] of Object.entries(geneIds)) {
      if (value > 14) {
        return { valid: false, error: `${name} must be between 0 and 14` };
      }
    }
    return { valid: true };
  }

  it("accepts valid input", () => {
    const result = validatePinInput({
      creatureId: 1,
      headGeneId: 6,
      bodyGeneId: 3,
      legsGeneId: 0,
      skinId: 5,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects missing fields", () => {
    const result = validatePinInput({ creatureId: 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Missing required field");
  });

  it("rejects non-integer values", () => {
    const result = validatePinInput({
      creatureId: 1.5,
      headGeneId: 6,
      bodyGeneId: 3,
      legsGeneId: 0,
      skinId: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("non-negative integer");
  });

  it("rejects negative values", () => {
    const result = validatePinInput({
      creatureId: -1,
      headGeneId: 6,
      bodyGeneId: 3,
      legsGeneId: 0,
      skinId: 5,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects gene IDs out of range", () => {
    const result = validatePinInput({
      creatureId: 1,
      headGeneId: 15,
      bodyGeneId: 3,
      legsGeneId: 0,
      skinId: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("between 0 and 14");
  });

  it("rejects non-object body", () => {
    const result = validatePinInput("not an object");
    expect(result.valid).toBe(false);
  });

  it("rejects null body", () => {
    const result = validatePinInput(null);
    expect(result.valid).toBe(false);
  });
});
