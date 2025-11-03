import React from "react";
import type { Creature } from "gene_splicer";

interface CreatureRendererProps {
  creature: Creature;
  size?: number;
}

// Rarity-based visual effects (CSS filters and overlays)
const RARITY_EFFECTS = {
  Common: {
    filter: "none",
    overlay: "transparent",
    glow: "0 0 0px transparent",
  },
  Rare: {
    filter: "hue-rotate(270deg) saturate(1.3)",
    overlay: "rgba(159, 122, 234, 0.15)",
    glow: "0 0 15px rgba(159, 122, 234, 0.6)",
  },
  Legendary: {
    filter: "hue-rotate(30deg) saturate(1.5) brightness(1.1)",
    overlay: "rgba(245, 158, 11, 0.2)",
    glow: "0 0 20px rgba(245, 158, 11, 0.8)",
  },
};

/**
 * CreatureRenderer - Renders creatures using layered PNG assets
 *
 * Asset structure:
 * - public/assets/creatures/heads/head-{0-9}.png
 * - public/assets/creatures/torsos/torso-{0-9}.png
 * - public/assets/creatures/legs/legs-{0-9}.png
 *
 * Gene IDs are mapped using modulo 10 to select the appropriate asset.
 */
export const CreatureRenderer: React.FC<CreatureRendererProps> = ({
  creature,
  size = 300,
}) => {
  // Map gene IDs to asset indices (0-9)
  const headIndex = creature.head_gene.id % 10;
  const torsoIndex = creature.torso_gene.id % 10;
  const legsIndex = creature.legs_gene.id % 10;

  // Build asset paths
  const headAsset = `/assets/creatures/heads/head-${headIndex}.png`;
  const torsoAsset = `/assets/creatures/torsos/torso-${torsoIndex}.png`;
  const legsAsset = `/assets/creatures/legs/legs-${legsIndex}.png`;

  // Get rarity effects for each body part
  const headEffects =
    RARITY_EFFECTS[
      creature.head_gene.rarity.tag as keyof typeof RARITY_EFFECTS
    ] || RARITY_EFFECTS.Common;
  const torsoEffects =
    RARITY_EFFECTS[
      creature.torso_gene.rarity.tag as keyof typeof RARITY_EFFECTS
    ] || RARITY_EFFECTS.Common;
  const legsEffects =
    RARITY_EFFECTS[
      creature.legs_gene.rarity.tag as keyof typeof RARITY_EFFECTS
    ] || RARITY_EFFECTS.Common;

  // Calculate overall glow effect (use the highest rarity)
  const rarities = [
    creature.head_gene.rarity.tag,
    creature.torso_gene.rarity.tag,
    creature.legs_gene.rarity.tag,
  ];
  const hasLegendary = rarities.includes("Legendary");
  const hasRare = rarities.includes("Rare");

  const containerGlow = hasLegendary
    ? RARITY_EFFECTS.Legendary.glow
    : hasRare
      ? RARITY_EFFECTS.Rare.glow
      : RARITY_EFFECTS.Common.glow;

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        filter: `drop-shadow(${containerGlow})`,
      }}
    >
      {/* Legs layer (bottom) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <img
          src={legsAsset}
          alt={`Legs ${legsIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: legsEffects.filter,
          }}
          onError={(e) => {
            // Fallback to placeholder if image doesn't exist
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Legs rarity overlay */}
        {legsEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: legsEffects.overlay,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </div>

      {/* Torso layer (middle) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <img
          src={torsoAsset}
          alt={`Torso ${torsoIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: torsoEffects.filter,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Torso rarity overlay */}
        {torsoEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: torsoEffects.overlay,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </div>

      {/* Head layer (top) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <img
          src={headAsset}
          alt={`Head ${headIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: headEffects.filter,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {/* Head rarity overlay */}
        {headEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: headEffects.overlay,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </div>

      {/* Placeholder when no assets are loaded */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          color: "#999",
          fontSize: "12px",
          pointerEvents: "none",
        }}
      >
        <div>Creature #{creature.id}</div>
        <div style={{ fontSize: "10px", marginTop: "4px" }}>
          Assets: {headIndex}/{torsoIndex}/{legsIndex}
        </div>
      </div>
    </div>
  );
};
