import React, { useEffect } from "react";
import type { Creature } from "gene_splicer";

interface CreatureRendererProps {
  creature: Creature;
  size?: number;
}

// Inject keyframe animations into the document
const injectAnimations = () => {
  if (typeof document === "undefined") return;

  const styleId = "creature-animations";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes bounce-foot-left {
      0%, 100% {
        transform: scaleX(-1) translateY(0px) rotate(0deg);
      }
      50% {
        transform: scaleX(-1) translateY(-2px) rotate(1deg);
      }
    }

    @keyframes bounce-foot-right {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-2px) rotate(-1deg);
      }
    }

    @keyframes bounce-arm-left {
      0%, 100% {
        transform: scaleX(-1) translateY(0px) rotate(0deg);
      }
      50% {
        transform: scaleX(-1) translateY(-4px) rotate(2deg);
      }
    }

    @keyframes bounce-torso {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-5px) rotate(-0.3deg);
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

    @keyframes bounce-head {
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
  // Inject animations on mount
  useEffect(() => {
    injectAnimations();
  }, []);

  // Map gene IDs to asset indices (0-9)
  const headIndex = creature.head_gene.id % 10;
  const torsoIndex = creature.torso_gene.id % 10;
  const footIndex = creature.legs_gene.id % 10; // legs_gene controls feet

  // Build asset paths
  const headAsset = `/assets/creatures/heads/head-${headIndex}.png`;
  const torsoAsset = `/assets/creatures/torsos/torso-${torsoIndex}.png`;
  const armAsset = `/assets/creatures/arms/arm-${torsoIndex}.png`; // Arms match torso
  const footAsset = `/assets/creatures/feet/foot-${footIndex}.png`;

  // Get rarity effects for each body part
  const headEffects =
    RARITY_EFFECTS[
      creature.head_gene.rarity.tag as keyof typeof RARITY_EFFECTS
    ] || RARITY_EFFECTS.Common;
  const torsoEffects =
    RARITY_EFFECTS[
      creature.torso_gene.rarity.tag as keyof typeof RARITY_EFFECTS
    ] || RARITY_EFFECTS.Common;
  const armEffects = torsoEffects; // Arms inherit torso rarity
  const footEffects =
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
      {/* Foot left layer (bottom) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          animation: "bounce-foot-left 2s ease-in-out infinite",
          animationDelay: "0s",
        }}
      >
        <img
          src={footAsset}
          alt={`Foot left ${footIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: footEffects.filter,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {footEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: footEffects.overlay,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </div>

      {/* Foot right layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          animation: "bounce-foot-right 2s ease-in-out infinite",
          animationDelay: "0.1s",
        }}
      >
        <img
          src={footAsset}
          alt={`Foot right ${footIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: footEffects.filter,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {footEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: footEffects.overlay,
              pointerEvents: "none",
              mixBlendMode: "multiply",
            }}
          />
        )}
      </div>

      {/* Arm left layer (behind torso) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          animation: "bounce-arm-left 2.6s ease-in-out infinite",
          animationDelay: "0.05s",
        }}
      >
        <img
          src={armAsset}
          alt={`Arm left ${torsoIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: armEffects.filter,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {armEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: armEffects.overlay,
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
          animation: "bounce-torso 2.8s ease-in-out infinite",
          animationDelay: "0.15s",
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

      {/* Arm right layer (in front of torso) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          animation: "bounce-arm-right 2.6s ease-in-out infinite",
          animationDelay: "0.2s",
        }}
      >
        <img
          src={armAsset}
          alt={`Arm right ${torsoIndex}`}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: armEffects.filter,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        {armEffects.overlay !== "transparent" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: armEffects.overlay,
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
          animation: "bounce-head 3.2s ease-in-out infinite",
          animationDelay: "0.3s",
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
          Assets: {headIndex}/{torsoIndex}/{footIndex}
        </div>
      </div>
    </div>
  );
};
