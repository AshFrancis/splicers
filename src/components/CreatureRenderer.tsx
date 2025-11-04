import React, { useEffect } from "react";
import type { Creature } from "gene_splicer";

interface CreatureRendererProps {
  creature: Creature;
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

/**
 * CreatureRenderer - Renders creatures using layered PNG assets in 3 rows
 *
 * Asset structure (creatures2):
 * - Head gene controls: Head.png, Face 01.png
 * - Torso gene controls: Body.png, Left Arm.png, Right Arm.png, Left Hand.png, Right Hand.png
 * - Legs gene controls: Left Leg.png, Right Leg.png
 *
 * Gene IDs (0-14) map to 15 creature variants.
 * Layout: 3 rows (head, torso, legs) with slight overlap between rows
 * Layer order within rows (bottom to top):
 * - Head row: Head, Face
 * - Torso row: Right Hand, Right Arm, Torso, Left Hand, Left Arm
 * - Legs row: Right Leg, Left Leg
 */
export const CreatureRenderer: React.FC<CreatureRendererProps> = ({
  creature,
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

  // Render helper for body part layers at actual size
  const renderBodyPart = (
    asset: string,
    alt: string,
    animation: string,
    delay: string,
    offsetX: number = 0,
    offsetY: number = 0,
  ) => {
    const transform =
      offsetX || offsetY
        ? `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`
        : "translate(-50%, -50%)";

    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform,
          animation: `${animation} 2.8s ease-in-out infinite`,
          animationDelay: delay,
        }}
      >
        <img
          src={asset}
          alt={alt}
          style={{
            display: "block",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    );
  };

  // Helper to render a row with layered parts
  const renderRow = (
    children: React.ReactNode,
    marginTop: string = "0px",
    minHeight: string = "200px",
  ) => (
    <div
      style={{
        position: "relative",
        minHeight,
        width: "100%",
        marginTop,
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Row 1: Head assets */}
      {renderRow(
        <>
          {/* Head layer */}
          {renderBodyPart(headAsset, "Head", "bounce-head", "0.3s")}

          {/* Face layer (on top) - offset 30px left, 40px top */}
          {renderBodyPart(faceAsset, "Face", "bounce-face", "0.3s", 30, 40)}
        </>,
      )}

      {/* Row 2: Torso assets */}
      {renderRow(
        <>
          {/* Right Hand (bottom layer) */}
          {renderBodyPart(
            rightHandAsset,
            "Right Hand",
            "bounce-hand-right",
            "0.25s",
          )}

          {/* Right Arm */}
          {renderBodyPart(
            rightArmAsset,
            "Right Arm",
            "bounce-arm-right",
            "0.2s",
          )}

          {/* Torso/Body */}
          {renderBodyPart(bodyAsset, "Torso", "bounce-body", "0.15s")}

          {/* Left Hand */}
          {renderBodyPart(
            leftHandAsset,
            "Left Hand",
            "bounce-hand-left",
            "0.08s",
          )}

          {/* Left Arm (top layer) */}
          {renderBodyPart(leftArmAsset, "Left Arm", "bounce-arm-left", "0.05s")}
        </>,
        "-20px", // Negative margin for overlap with head row
      )}

      {/* Row 3: Legs assets */}
      {renderRow(
        <>
          {/* Right Leg */}
          {renderBodyPart(
            rightLegAsset,
            "Right Leg",
            "bounce-leg-right",
            "0.1s",
          )}

          {/* Left Leg (on top) */}
          {renderBodyPart(leftLegAsset, "Left Leg", "bounce-leg-left", "0s")}
        </>,
        "-20px", // Negative margin for overlap with torso row
      )}

      {/* Debug info */}
      <div
        style={{
          textAlign: "center",
          color: "#999",
          fontSize: "12px",
          marginTop: "8px",
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
