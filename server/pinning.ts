import { PinataSDK } from "pinata";

function getPinata(): PinataSDK {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not configured");
  return new PinataSDK({ pinataJwt: jwt });
}

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

interface PinCreatureArgs {
  creatureId: number;
  headGeneId: number;
  bodyGeneId: number;
  legsGeneId: number;
  skinId: number;
}

export async function pinCreature(args: PinCreatureArgs) {
  const pinata = getPinata();

  // Build NFT metadata (standard format)
  const metadata = {
    name: `Splicer Creature #${args.creatureId}`,
    description:
      "A gene-spliced creature from the Splicers NFT game on Stellar.",
    attributes: [
      { trait_type: "Head Gene", value: getGeneType(args.headGeneId) },
      { trait_type: "Head Gene ID", value: args.headGeneId },
      { trait_type: "Head Rarity", value: getGeneRarity(args.headGeneId) },
      { trait_type: "Body Gene", value: getGeneType(args.bodyGeneId) },
      { trait_type: "Body Gene ID", value: args.bodyGeneId },
      { trait_type: "Body Rarity", value: getGeneRarity(args.bodyGeneId) },
      { trait_type: "Legs Gene", value: getGeneType(args.legsGeneId) },
      { trait_type: "Legs Gene ID", value: args.legsGeneId },
      { trait_type: "Legs Rarity", value: getGeneRarity(args.legsGeneId) },
      { trait_type: "Skin", value: args.skinId },
    ],
  };

  // Pin metadata JSON to IPFS
  const upload = await pinata.upload.json(metadata).addMetadata({
    name: `splicer-creature-${args.creatureId}.json`,
  });

  const metadataUrl = `https://gateway.pinata.cloud/ipfs/${upload.IpfsHash}`;

  console.log(`[pinning] Creature #${args.creatureId} pinned: ${metadataUrl}`);

  return {
    ipfsHash: upload.IpfsHash,
    metadataUrl,
  };
}
