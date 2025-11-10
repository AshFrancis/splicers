import React, { useEffect } from "react";
import type { Creature } from "gene_splicer";

type AttackType = "punch" | "kick" | "headbutt" | null;

interface CreatureRendererProps {
  creature: Creature;
  isAttacking?: boolean;
  attackType?: AttackType;
  isKnockedOut?: boolean;
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

// Inject keyframe animations into the document (using CSS custom properties for variation)
const injectAnimations = () => {
  if (typeof document === "undefined") return;

  const styleId = "creature-idle-animations";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes idle-head {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(var(--head-y)) rotate(var(--head-rotation));
      }
    }

    @keyframes idle-body {
      0%, 100% {
        transform: translateY(0px);
      }
      50% {
        transform: translateY(var(--body-y));
      }
    }

    @keyframes idle-arm-swing {
      0%, 100% {
        transform: rotate(0deg);
      }
      50% {
        transform: rotate(var(--arm-swing));
      }
    }

    @keyframes idle-arm-swing-reverse {
      0%, 100% {
        transform: rotate(0deg);
      }
      50% {
        transform: rotate(var(--arm-swing-reverse));
      }
    }

    @keyframes punch-right {
      0% { transform: rotate(0deg); }
      30% { transform: rotate(-60deg); }
      60% { transform: rotate(-60deg); }
      100% { transform: rotate(0deg); }
    }

    @keyframes punch-left {
      0% { transform: rotate(0deg); }
      30% { transform: rotate(60deg); }
      60% { transform: rotate(60deg); }
      100% { transform: rotate(0deg); }
    }

    @keyframes kick-leg {
      0% { transform: translate(-50%, -50%) rotate(0deg); }
      30% { transform: translate(calc(-50% + 98px), calc(-50% + -20px)) rotate(-45deg); }
      60% { transform: translate(calc(-50% + 98px), calc(-50% + -20px)) rotate(-45deg); }
      100% { transform: translate(-50%, -50%) rotate(0deg); }
    }

    @keyframes headbutt-head {
      0% { transform: translateY(0px) rotate(0deg); }
      30% { transform: translateY(-15px) rotate(-10deg); }
      60% { transform: translateY(-15px) rotate(-10deg); }
      100% { transform: translateY(0px) rotate(0deg); }
    }
  `;
  document.head.appendChild(style);
};

// Generate deterministic pseudo-random value from gene IDs
const generateVariation = (seed: number, min: number, max: number): number => {
  // Simple pseudo-random using sine function
  const x = Math.sin(seed) * 10000;
  const random = x - Math.floor(x);
  return min + random * (max - min);
};

/**
 * CreatureRenderer - Renders creatures using layered PNG assets in 3 rows
 *
 * Asset structure:
 * - Head gene controls: Head.png, Face 01.png
 * - Body gene controls: Body.png, Left Arm.png, Right Arm.png, Left Hand.png, Right Hand.png
 * - Legs gene controls: Left Leg.png, Right Leg.png
 *
 * Gene IDs (0-14) map to 15 creature variants.
 * Layout: 3 rows (head, body, legs) with slight overlap between rows
 * Layer order within rows (bottom to top):
 * - Head row: Head, Face
 * - Body row: Right Hand, Right Arm, Body, Left Hand, Left Arm
 * - Legs row: Right Leg, Left Leg
 */
export const CreatureRenderer: React.FC<CreatureRendererProps> = ({
  creature,
  isAttacking = false,
  attackType = null,
  isKnockedOut = false,
}) => {
  // Inject animations on mount
  useEffect(() => {
    injectAnimations();
  }, []);

  // Get creature folder names based on gene IDs
  const headFolder = CREATURE_FOLDERS[creature.head_gene.id % 15];
  const bodyFolder = CREATURE_FOLDERS[creature.body_gene.id % 15];
  const legsFolder = CREATURE_FOLDERS[creature.legs_gene.id % 15];

  // Generate deterministic animation variations based on gene IDs
  const geneSeed =
    creature.head_gene.id +
    creature.body_gene.id * 100 +
    creature.legs_gene.id * 10000;

  // Vary animation parameters (deterministic based on genes)
  const animDuration = generateVariation(geneSeed, 1.0, 1.4);
  const headY = generateVariation(geneSeed + 1, -3, -7);
  const headRotation = generateVariation(geneSeed + 2, -1, -3);
  const bodyY = generateVariation(geneSeed + 3, -2, -4);
  const armSwing = generateVariation(geneSeed + 4, 6, 10);

  // Animation delay for extra variation (some creatures start mid-animation)
  const animDelay = generateVariation(geneSeed + 5, -0.6, 0);

  // Build asset paths for each body part
  const basePath = "/assets/creatures";
  const headAsset = `${basePath}/${headFolder}/Parts/Head.png`;
  const faceAsset = `${basePath}/${headFolder}/Parts/Face 01.png`;
  const bodyAsset = `${basePath}/${bodyFolder}/Parts/Body.png`;
  const leftArmAsset = `${basePath}/${bodyFolder}/Parts/Left Arm.png`;
  const rightArmAsset = `${basePath}/${bodyFolder}/Parts/Right Arm.png`;
  const leftHandAsset = `${basePath}/${bodyFolder}/Parts/Left Hand.png`;
  const rightHandAsset = `${basePath}/${bodyFolder}/Parts/Right Hand.png`;
  const leftLegAsset = `${basePath}/${legsFolder}/Parts/Left Leg.png`;
  const rightLegAsset = `${basePath}/${legsFolder}/Parts/Right Leg.png`;

  // Render helper for body part layers at actual size
  const renderBodyPart = (
    asset: string,
    alt: string,
    zIndex: number = 0,
    offsetX: number = 0,
    offsetY: number = 0,
    imgTransformX: number = 0,
    imgTransformY: number = 0,
  ) => {
    const transform =
      offsetX || offsetY
        ? `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`
        : "translate(-50%, -50%)";

    const imgTransform =
      imgTransformX || imgTransformY
        ? `translate(${imgTransformX}px, ${imgTransformY}px)`
        : undefined;

    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform,
          zIndex,
        }}
      >
        <img
          src={asset}
          alt={alt}
          style={{
            display: "block",
            transform: imgTransform,
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    );
  };

  // Helper to render arm/hand group with rotation wrapper
  const renderArmGroup = (
    armAsset: string,
    handAsset: string,
    side: "left" | "right",
    zIndexBase: number,
    armTransformX: number,
    armTransformY: number,
    handTransformX: number,
    handTransformY: number,
    animDuration: number,
    animDelay: number,
    isKnockedOut: boolean,
  ) => {
    const animation = isKnockedOut
      ? "none"
      : isAttacking && attackType === "punch"
        ? side === "left"
          ? "punch-left"
          : "punch-right"
        : side === "left"
          ? "idle-arm-swing"
          : "idle-arm-swing-reverse";
    const transformOrigin = side === "left" ? "80px -20px" : "-80px -20px";

    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          animation: `${animation} ${animDuration}s ease-in-out ${animDelay}s infinite`,
          transformOrigin,
        }}
      >
        {/* Hand (behind arm) */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: zIndexBase,
          }}
        >
          <img
            src={handAsset}
            alt={`${side} Hand`}
            style={{
              display: "block",
              transform: `translate(${handTransformX}px, ${handTransformY}px)`,
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        {/* Arm (on top) */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: zIndexBase + 5,
          }}
        >
          <img
            src={armAsset}
            alt={`${side} Arm`}
            style={{
              display: "block",
              transform: `translate(${armTransformX}px, ${armTransformY}px)`,
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      </div>
    );
  };

  // Helper to render a row with layered parts
  const renderRow = (
    children: React.ReactNode,
    marginTop: string = "0px",
    minHeight: string = "200px",
    zIndex: number = 0,
  ) => (
    <div
      style={{
        position: "relative",
        minHeight,
        width: "100%",
        marginTop,
        zIndex,
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
        transform: "scale(0.4)",
        transformOrigin: "top center",
        // CSS custom properties for animation variation
        ["--head-y" as string]: `${headY}px`,
        ["--head-rotation" as string]: `${headRotation}deg`,
        ["--body-y" as string]: `${bodyY}px`,
        ["--arm-swing" as string]: `${armSwing}deg`,
        ["--arm-swing-reverse" as string]: `${-armSwing}deg`,
      }}
    >
      {/* Row 1: Head assets */}
      {renderRow(
        <div
          style={{
            animation: isKnockedOut
              ? "none"
              : isAttacking && attackType === "headbutt"
                ? "headbutt-head 0.4s ease-out"
                : `idle-head ${animDuration}s ease-in-out ${animDelay}s infinite`,
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {/* Head layer */}
          {renderBodyPart(headAsset, "Head", 1)}

          {/* Face layer (on top) - offset 45px right, 55px down */}
          {renderBodyPart(faceAsset, "Face", 2, 45, 55)}
        </div>,
        "0px",
        "300px",
        300,
      )}

      {/* Row 2: Body assets */}
      {renderRow(
        <>
          {/* Left Arm Group (bottom layer) */}
          {renderArmGroup(
            leftArmAsset,
            leftHandAsset,
            "left",
            10,
            80,
            -20,
            80,
            40,
            animDuration,
            animDelay,
            isKnockedOut,
          )}

          {/* Body (center) with animation */}
          <div
            style={{
              animation: isKnockedOut
                ? "none"
                : `idle-body ${animDuration}s ease-in-out ${animDelay}s infinite`,
              width: "100%",
              height: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            {renderBodyPart(bodyAsset, "Body", 20)}
          </div>

          {/* Right Arm Group (top layer) */}
          {renderArmGroup(
            rightArmAsset,
            rightHandAsset,
            "right",
            25,
            -80,
            -20,
            -80,
            40,
            animDuration,
            animDelay,
            isKnockedOut,
          )}
        </>,
        "-20px", // Negative margin for overlap with head row
        "200px",
        200,
      )}

      {/* Row 3: Legs assets */}
      {renderRow(
        <>
          {/* Right Leg (no animation) */}
          {renderBodyPart(rightLegAsset, "Right Leg", 1, 0, 0, -40, 0)}

          {/* Left Leg - with kick animation */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: isKnockedOut
                ? "none"
                : isAttacking && attackType === "kick"
                  ? "kick-leg 0.4s ease-out"
                  : "none",
              zIndex: 2,
            }}
          >
            <img
              src={leftLegAsset}
              alt="Left Leg"
              style={{
                display: "block",
                transform: "translate(40px, 0px)",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        </>,
        "-20px", // Negative margin for overlap with body row
        "70px",
        100,
      )}
    </div>
  );
};
