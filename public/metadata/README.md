# Gene Traits Metadata

This directory contains metadata for creature gene traits.

## gene-traits.json

Maps gene IDs (0-14) to named traits with rarity information.

**Structure:**

```json
{
  "version": "1.0.0",
  "description": "Gene trait metadata for creature body parts",
  "genes": [
    {
      "id": 0,
      "name": "Dark Oracle Head 1",
      "type": "Dark Oracle",
      "bodyPart": "head",
      "variant": 1,
      "rarity": "common",
      "folder": "Dark_Oracle_1"
    }
  ]
}
```

**Rarity Distribution:**

- **Legendary** (IDs 3-5): Golem variants
- **Rare** (IDs 6-8): Necromancer of the Shadow variants
- **Common** (IDs 0-2, 9-14): Dark Oracle, Skeleton Crusader, Skeleton Warrior variants

**Usage:**

- Frontend: Fetched by CreatureRenderer to display trait names and rarities
- IPFS: Can be pinned to IPFS for permanent, decentralized metadata storage
- Backend: Used by NFT generation service to create metadata JSON for OpenSea/marketplaces

**Note:** Each creature has three genes (head, torso, legs), each mapped to one of these 15 trait definitions. The actual body part (head/torso/legs) is determined by which gene slot it occupies, not the metadata itself.
