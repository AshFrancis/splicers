import React, { useEffect } from "react";
import type { Creature } from "gene_splicer";

interface CreatureRendererProps {
  creature: Creature;
  size?: number;
}

// Map gene IDs (0-14) to creature folder names
const CREATURE_FOLDERS = [
  "Dark_Oracle_1",
  "Dark_Oracle_2",
  "Dark_Oracle_3",
  "Golem_1",
  "Golem_2",
  "Golem_3",
  "Necromancer_of_the_Shadow_1",
  "Necromancer_of_the_Shadow_2",
  "Necromancer_of_the_Shadow_3",
  "Skeleton_Crusader_1",
  "Skeleton_Crusader_2",
  "Skeleton_Crusader_3",
  "Skeleton_Warrior_1",
  "Skeleton_Warrior_2",
  "Skeleton_Warrior_3",
];

// Inject keyframe animations into the document
const injectAnimations = () => {
  if (typeof document === "undefined") return;

  const styleId = "creature-animations";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes bounce-leg-left {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-2px) rotate(1deg);
      }
    }

    @keyframes bounce-leg-right {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-2px) rotate(-1deg);
      }
    }

    @keyframes bounce-body {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-5px) rotate(-0.3deg);
      }
    }

    @keyframes bounce-arm-left {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-4px) rotate(2deg);
      }
    }

    @keyframes bounce-arm-right {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-4px) rotate(-2deg);
      }
    }

    @keyframes bounce-hand-left {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-3px) rotate(3deg);
      }
    }

    @keyframes bounce-hand-right {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-3px) rotate(-3deg);
      }
    }

    @keyframes bounce-head {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-8px) rotate(0.8deg);
      }
    }

    @keyframes bounce-face {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-8px) rotate(0.8deg);
      }
    }
  `;
  document.head.appendChild(style);
};

// Rarity-based visual effects (CSS filters and overlays)
const RARITY_EFFECTS = {
  Normal: {
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
 * Asset structure (creatures2):
 * - Head gene controls: Head.png, Face 01.png
 * - Torso gene controls: Body.png, Left Arm.png, Right Arm.png, Left Hand.png, Right Hand.png
 * - Legs gene controls: Left Leg.png, Right Leg.png
 *
 * Gene IDs (0-14) map to 15 creature variants.
 * Layer order (bottom to top): Left Leg, Right Leg, Body, Left Arm, Right Arm, Left Hand, Right Hand, Head, Face
 */
export const CreatureRenderer: React.FC<CreatureRendererProps> = ({
  creature,
  size = 300,
}) => {
  // Inject animations on mount
  useEffect(() => {
    injectAnimations();
  }, []);

  // Get creature folder names based on gene IDs
  const headFolder = CREATURE_FOLDERS[creature.head_gene.id % 15];
  const torsoFolder = CREATURE_FOLDERS[creature.torso_gene.id % 15];
  const legsFolder = CREATURE_FOLDERS[creature.legs_gene.id % 15];

  // Build asset paths for each body part
  const basePath = "/assets/creatures2";
  const headAsset = `${basePath}/${headFolder}/Parts/Head.png`;
  const faceAsset = `${basePath}/${headFolder}/Parts/Face 01.png`;
  const bodyAsset = `${basePath}/${torsoFolder}/Parts/Body.png`;
  const leftArmAsset = `${basePath}/${torsoFolder}/Parts/Left Arm.png`;
  const rightArmAsset = `${basePath}/${torsoFolder}/Parts/Right Arm.png`;
  const leftHandAsset = `${basePath}/${torsoFolder}/Parts/Left Hand.png`;
  const rightHandAsset = `${basePath}/${torsoFolder}/Parts/Right Hand.png`;
  const leftLegAsset = `${basePath}/${legsFolder}/Parts/Left Leg.png`;
  const rightLegAsset = `${basePath}/${legsFolder}/Parts/Right Leg.png`;

  // Get rarity effects for each body part group
  const headEffects =
    RARITY_EFFECTS[creature.head_gene.rarity.tag] || RARITY_EFFECTS.Normal;
  const torsoEffects =
    RARITY_EFFECTS[creature.torso_gene.rarity.tag] || RARITY_EFFECTS.Normal;
  const legsEffects =
    RARITY_EFFECTS[creature.legs_gene.rarity.tag] || RARITY_EFFECTS.Normal;

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
      : RARITY_EFFECTS.Normal.glow;

  // Render helper for body part layers
  const renderBodyPart = (
    asset: string,
    alt: string,
    animation: string,
    delay: string,
    effects: typeof RARITY_EFFECTS.Normal,
  ) => (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        animation: `${animation} 2.8s ease-in-out infinite`,
        animationDelay: delay,
      }}
    >
      <img
        src={asset}
        alt={alt}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          filter: effects.filter,
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {effects.overlay !== "transparent" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: effects.overlay,
            pointerEvents: "none",
            mixBlendMode: "multiply",
          }}
        />
      )}
    </div>
  );

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: "relative",
        filter: `drop-shadow(${containerGlow})`,
      }}
    >
      {/* Layer 1: Left Leg (bottom) */}
      {renderBodyPart(
        leftLegAsset,
        "Left Leg",
        "bounce-leg-left",
        "0s",
        legsEffects,
      )}

      {/* Layer 2: Right Leg */}
      {renderBodyPart(
        rightLegAsset,
        "Right Leg",
        "bounce-leg-right",
        "0.1s",
        legsEffects,
      )}

      {/* Layer 3: Body */}
      {renderBodyPart(bodyAsset, "Body", "bounce-body", "0.15s", torsoEffects)}

      {/* Layer 4: Left Arm */}
      {renderBodyPart(
        leftArmAsset,
        "Left Arm",
        "bounce-arm-left",
        "0.05s",
        torsoEffects,
      )}

      {/* Layer 5: Right Arm */}
      {renderBodyPart(
        rightArmAsset,
        "Right Arm",
        "bounce-arm-right",
        "0.2s",
        torsoEffects,
      )}

      {/* Layer 6: Left Hand */}
      {renderBodyPart(
        leftHandAsset,
        "Left Hand",
        "bounce-hand-left",
        "0.08s",
        torsoEffects,
      )}

      {/* Layer 7: Right Hand */}
      {renderBodyPart(
        rightHandAsset,
        "Right Hand",
        "bounce-hand-right",
        "0.25s",
        torsoEffects,
      )}

      {/* Layer 8: Head */}
      {renderBodyPart(headAsset, "Head", "bounce-head", "0.3s", headEffects)}

      {/* Layer 9: Face (top) */}
      {renderBodyPart(faceAsset, "Face", "bounce-face", "0.3s", headEffects)}

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
          Head:{creature.head_gene.id} Torso:{creature.torso_gene.id} Legs:
          {creature.legs_gene.id}
        </div>
      </div>
    </div>
  );
};
