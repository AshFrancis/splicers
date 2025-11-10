import React, { useState, useEffect } from "react";
import { CreatureRenderer } from "./CreatureRenderer";
import type { Creature } from "gene_splicer";

interface WalkingCreaturesProps {
  creatures: Creature[];
}

interface WalkingCreature {
  creature: Creature;
  x: number;
  y: number;
  direction: "left" | "right";
  speed: number;
  isStopped: boolean;
  stopTimer: number;
  isJumping: boolean;
  jumpTimer: number;
  speedBoost: boolean;
  speedBoostTimer: number;
  showExclamation: boolean;
  exclamationTimer: number;
  noRandomTurnTimer: number;
}

export const WalkingCreatures: React.FC<WalkingCreaturesProps> = ({
  creatures,
}) => {
  const [walkingCreatures, setWalkingCreatures] = useState<WalkingCreature[]>(
    [],
  );
  const [previousCreatureCount, setPreviousCreatureCount] = useState(0);

  // Initialize walking creatures with random positions
  useEffect(() => {
    if (creatures.length === 0) {
      setWalkingCreatures([]);
      setPreviousCreatureCount(0);
      return;
    }

    // If counts match, nothing to do (prevents re-initialization after updating previousCreatureCount)
    if (creatures.length === previousCreatureCount) {
      return;
    }

    // Check if this is a new creature being added
    if (
      creatures.length > previousCreatureCount &&
      walkingCreatures.length > 0
    ) {
      // Only add the new creature, don't reinitialize existing ones
      const newCreature = creatures[creatures.length - 1];
      const spawnFromLeft = Math.random() > 0.5;

      const newWalkingCreature: WalkingCreature = {
        creature: newCreature,
        x: spawnFromLeft ? -150 : window.innerWidth + 150, // Spawn off-screen
        y: 0,
        direction: spawnFromLeft ? "right" : "left", // Walk toward center
        speed: 0.8, // Faster entrance
        isStopped: false,
        stopTimer: 0,
        isJumping: false,
        jumpTimer: 0,
        speedBoost: true, // Start with speed boost for dramatic entrance
        speedBoostTimer: 120, // 2 seconds of fast walking
        showExclamation: false,
        exclamationTimer: 0,
        noRandomTurnTimer: 300, // No random turns for first 5 seconds
      };

      // Add new creature and make existing creatures react
      const spawnSide =
        newWalkingCreature.direction === "right" ? "left" : "right";

      setWalkingCreatures((prev) => [
        // Existing creatures react to new arrival
        ...prev.map((wc) => ({
          ...wc,
          direction: spawnSide,
          isJumping: true,
          jumpTimer: 60, // Jump for 1 second
          showExclamation: true,
          exclamationTimer: 120, // Show exclamation for 2 seconds
          isStopped: true,
          stopTimer: 90, // Stay stopped for 1.5 seconds
        })),
        // Add new creature at the end
        newWalkingCreature,
      ]);

      setPreviousCreatureCount(creatures.length);
      return;
    }

    // Initial load - create all creatures off-screen
    const initialized = creatures.map((creature, index) => {
      const spawnFromLeft = index % 2 === 0; // Alternate sides: even indices from left, odd from right
      return {
        creature,
        x: spawnFromLeft ? -150 : window.innerWidth + 150, // Spawn just outside window
        y: 0, // At the bottom of container
        direction: spawnFromLeft ? "right" : "left", // Walk toward center: left side walks right, right side walks left
        speed: 0.2 + Math.random() * 0.3, // Random speed between 0.2-0.5 px/frame (slower)
        isStopped: false,
        stopTimer: 0,
        isJumping: false,
        jumpTimer: 0,
        speedBoost: true, // Start with speed boost to walk in quickly
        speedBoostTimer: 180, // 3 seconds of faster walking to get on screen
        showExclamation: false,
        exclamationTimer: 0,
        noRandomTurnTimer: 300, // No random turns for first 5 seconds
      };
    });

    setWalkingCreatures(initialized);
    setPreviousCreatureCount(creatures.length);
  }, [creatures, previousCreatureCount]);

  // Animation loop
  useEffect(() => {
    if (walkingCreatures.length === 0) return;

    let animationFrameId: number;

    const animate = () => {
      setWalkingCreatures((prev) =>
        prev.map((wc) => {
          let newX = wc.x;
          let newDirection = wc.direction;
          let isStopped = wc.isStopped;
          let stopTimer = wc.stopTimer;
          let isJumping = wc.isJumping;
          let jumpTimer = wc.jumpTimer;
          let speedBoost = wc.speedBoost;
          let speedBoostTimer = wc.speedBoostTimer;
          let showExclamation = wc.showExclamation;
          let exclamationTimer = wc.exclamationTimer;
          let noRandomTurnTimer = wc.noRandomTurnTimer;

          // Handle no random turn timer
          if (noRandomTurnTimer > 0) {
            noRandomTurnTimer--;
          }

          // Handle jumping animation
          if (isJumping) {
            jumpTimer--;
            if (jumpTimer <= 0) {
              isJumping = false;
            }
          }

          // Handle speed boost timer
          if (speedBoost) {
            speedBoostTimer--;
            if (speedBoostTimer <= 0) {
              speedBoost = false;
            }
          }

          // Handle exclamation timer
          if (showExclamation) {
            exclamationTimer--;
            if (exclamationTimer <= 0) {
              showExclamation = false;
            }
          }

          // Handle stopping before flip
          if (isStopped) {
            stopTimer--;
            if (stopTimer <= 0) {
              // Finished stopping, flip direction
              newDirection = wc.direction === "left" ? "right" : "left";
              isStopped = false;
            }
            return {
              ...wc,
              direction: newDirection,
              isStopped,
              stopTimer,
              isJumping,
              jumpTimer,
              speedBoost,
              speedBoostTimer,
              showExclamation,
              exclamationTimer,
              noRandomTurnTimer,
            };
          }

          // Random chance to stop and flip direction (0.08% chance per frame) - only after 5 seconds
          if (noRandomTurnTimer === 0 && Math.random() < 0.0008) {
            return {
              ...wc,
              isStopped: true,
              stopTimer: 60, // Stop for 60 frames (~1 second)
              isJumping,
              jumpTimer,
              speedBoost,
              speedBoostTimer,
              showExclamation,
              exclamationTimer,
              noRandomTurnTimer,
            };
          }

          // Calculate current speed (with boost if active)
          const currentSpeed = speedBoost ? wc.speed * 2.5 : wc.speed;

          // Move creature
          if (wc.direction === "right") {
            newX += currentSpeed;
            if (newX > window.innerWidth - 60) {
              // At right edge, stop and turn around (stay on-screen) - account for 60px width
              return {
                ...wc,
                isStopped: true,
                stopTimer: 60,
                isJumping,
                jumpTimer,
                speedBoost,
                speedBoostTimer,
                showExclamation,
                exclamationTimer,
                noRandomTurnTimer,
              };
            }
          } else {
            newX -= currentSpeed;
            if (newX < 0) {
              // At left edge, stop and turn around (stay on-screen)
              return {
                ...wc,
                isStopped: true,
                stopTimer: 60,
                isJumping,
                jumpTimer,
                speedBoost,
                speedBoostTimer,
                showExclamation,
                exclamationTimer,
                noRandomTurnTimer,
              };
            }
          }

          return {
            ...wc,
            x: newX,
            direction: newDirection,
            isJumping,
            jumpTimer,
            speedBoost,
            speedBoostTimer,
            showExclamation,
            exclamationTimer,
            noRandomTurnTimer,
          };
        }),
      );

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [walkingCreatures.length]);

  if (walkingCreatures.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "27px",
        left: 0,
        width: "100%",
        height: "83px",
        zIndex: 1000,
        overflow: "visible",
      }}
    >
      {walkingCreatures.map((wc, index) => (
        <div
          key={wc.creature.id}
          onClick={() => {
            setWalkingCreatures((prev) =>
              prev.map((creature, i) =>
                i === index
                  ? {
                      ...creature,
                      isJumping: true,
                      jumpTimer: 20, // Jump for 20 frames (~0.33 seconds)
                      speedBoost: true,
                      speedBoostTimer: 300, // Boost for 300 frames (~5 seconds)
                      showExclamation: true,
                      exclamationTimer: 45, // Show for 45 frames (~0.75 seconds)
                    }
                  : creature,
              ),
            );
          }}
          style={{
            position: "absolute",
            bottom: `${wc.y}px`,
            left: `${wc.x}px`,
            height: "83px",
            width: "60px",
            transform: `scaleX(${wc.direction === "left" ? -1 : 1})`,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              transform: `translateY(${wc.isJumping ? "-30px" : "0px"})`,
              transition: "transform 0.2s ease-out",
              overflow: "visible",
            }}
          >
            <div
              style={{
                transform: "scale(0.4)",
                transformOrigin: "center center",
                height: "83px",
                justifyContent: "center",
                position: "relative",
                overflow: "visible",
              }}
            >
              <CreatureRenderer creature={wc.creature} isWalking={true} />

              {/* Exclamation mark */}
              {wc.showExclamation && (
                <img
                  src="/assets/exclamation.png"
                  alt="!"
                  style={{
                    position: "absolute",
                    top: "-80px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "120px",
                    height: "auto",
                    pointerEvents: "none",
                    zIndex: 10000,
                    animation:
                      wc.exclamationTimer > 15
                        ? "exclamation-appear 0.15s ease-out forwards"
                        : "exclamation-fade 0.5s ease-out forwards",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
