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
}

export const WalkingCreatures: React.FC<WalkingCreaturesProps> = ({
  creatures,
}) => {
  const [walkingCreatures, setWalkingCreatures] = useState<WalkingCreature[]>(
    [],
  );

  // Initialize walking creatures with random positions
  useEffect(() => {
    if (creatures.length === 0) return;

    const initialized = creatures.map((creature, index) => ({
      creature,
      x: (index * 300) % window.innerWidth, // Spread them out
      y: Math.random() * 50, // Random vertical offset
      direction: Math.random() > 0.5 ? "left" : ("right" as "left" | "right"),
      speed: 0.3 + Math.random() * 0.5, // Random speed between 0.3-0.8 px/frame
    }));

    setWalkingCreatures(initialized);
  }, [creatures]);

  // Animation loop
  useEffect(() => {
    if (walkingCreatures.length === 0) return;

    const animationFrame = requestAnimationFrame(function animate() {
      setWalkingCreatures((prev) =>
        prev.map((wc) => {
          let newX = wc.x;
          let newDirection = wc.direction;

          // Move creature
          if (wc.direction === "right") {
            newX += wc.speed;
            if (newX > window.innerWidth + 120) {
              // Off right edge, turn around
              newDirection = "left";
            }
          } else {
            newX -= wc.speed;
            if (newX < -120) {
              // Off left edge, turn around
              newDirection = "right";
            }
          }

          return {
            ...wc,
            x: newX,
            direction: newDirection,
          };
        }),
      );

      requestAnimationFrame(animate);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [walkingCreatures.length]);

  if (walkingCreatures.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "120px",
        pointerEvents: "none",
        zIndex: 1000,
        overflow: "hidden",
      }}
    >
      {walkingCreatures.map((wc) => (
        <div
          key={wc.creature.id}
          style={{
            position: "absolute",
            bottom: `${wc.y}px`,
            left: `${wc.x}px`,
            height: "120px",
            width: "120px",
            transform: wc.direction === "left" ? "scaleX(-1)" : "scaleX(1)",
            transition: "transform 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              transform: "scale(0.15)",
              transformOrigin: "bottom center",
              height: "800px",
              width: "800px",
              marginLeft: "-340px",
            }}
          >
            <CreatureRenderer creature={wc.creature} />
          </div>
        </div>
      ))}
    </div>
  );
};
