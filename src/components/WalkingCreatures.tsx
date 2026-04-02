import React, { useState, useEffect, useRef, useCallback } from "react";
import { CreatureRenderer } from "./CreatureRenderer";
import type { Creature } from "gene_splicer";

const CREATURE_WIDTH = 60;
const CREATURE_SCALE = 0.4;
const CONTAINER_HEIGHT = 83;
const BOTTOM_OFFSET = 27;
const JUMP_HEIGHT = 30;
const INITIAL_NO_TURN_FRAMES = 300;
const STOP_FRAMES = 60;

interface WalkingCreaturesProps {
  creatures: Creature[];
}

interface WalkingState {
  creature: Creature;
  x: number;
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
  // State only for triggering re-renders when creatures are added/removed
  const [creatureIds, setCreatureIds] = useState<number[]>([]);
  const stateRef = useRef<WalkingState[]>([]);
  const domRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const exclamationRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  const previousCountRef = useRef(0);

  // Initialize or update walking creatures
  useEffect(() => {
    if (creatures.length === 0) {
      stateRef.current = [];
      previousCountRef.current = 0;
      setCreatureIds([]);
      return;
    }

    if (creatures.length === previousCountRef.current) return;

    if (
      creatures.length > previousCountRef.current &&
      stateRef.current.length > 0
    ) {
      // Add new creature, make existing ones react
      const newCreature = creatures[creatures.length - 1];
      const spawnFromLeft = Math.random() > 0.5;
      const spawnSide: "left" | "right" = spawnFromLeft ? "right" : "left";

      stateRef.current = stateRef.current.map((wc) => ({
        ...wc,
        direction: spawnSide === "left" ? "right" : "left",
        isJumping: true,
        jumpTimer: 60,
        showExclamation: true,
        exclamationTimer: 120,
        isStopped: true,
        stopTimer: 90,
      }));

      stateRef.current.push({
        creature: newCreature,
        x: spawnFromLeft ? -150 : window.innerWidth + 150,
        direction: spawnFromLeft ? "right" : "left",
        speed: 0.8,
        isStopped: false,
        stopTimer: 0,
        isJumping: false,
        jumpTimer: 0,
        speedBoost: true,
        speedBoostTimer: 120,
        showExclamation: false,
        exclamationTimer: 0,
        noRandomTurnTimer: INITIAL_NO_TURN_FRAMES,
      });
    } else {
      // Initial load
      stateRef.current = creatures.map((creature, index) => {
        const spawnFromLeft = index % 2 === 0;
        return {
          creature,
          x: spawnFromLeft ? -150 : window.innerWidth + 150,
          direction: (spawnFromLeft ? "right" : "left"),
          speed: 0.2 + Math.random() * 0.3,
          isStopped: false,
          stopTimer: 0,
          isJumping: false,
          jumpTimer: 0,
          speedBoost: true,
          speedBoostTimer: 180,
          showExclamation: false,
          exclamationTimer: 0,
          noRandomTurnTimer: INITIAL_NO_TURN_FRAMES,
        };
      });
    }

    previousCountRef.current = creatures.length;
    setCreatureIds(stateRef.current.map((wc) => wc.creature.id));
  }, [creatures]);

  // Animation loop — updates DOM directly via refs, no setState
  useEffect(() => {
    if (creatureIds.length === 0) return;

    let animationFrameId: number;

    const animate = () => {
      for (const wc of stateRef.current) {
        // Decrement timers
        if (wc.noRandomTurnTimer > 0) wc.noRandomTurnTimer--;
        if (wc.isJumping) {
          wc.jumpTimer--;
          if (wc.jumpTimer <= 0) wc.isJumping = false;
        }
        if (wc.speedBoost) {
          wc.speedBoostTimer--;
          if (wc.speedBoostTimer <= 0) wc.speedBoost = false;
        }
        if (wc.showExclamation) {
          wc.exclamationTimer--;
          if (wc.exclamationTimer <= 0) wc.showExclamation = false;
        }

        // Handle stopping
        if (wc.isStopped) {
          wc.stopTimer--;
          if (wc.stopTimer <= 0) {
            wc.direction = wc.direction === "left" ? "right" : "left";
            wc.isStopped = false;
          }
        } else {
          // Random stop chance
          if (wc.noRandomTurnTimer === 0 && Math.random() < 0.0008) {
            wc.isStopped = true;
            wc.stopTimer = STOP_FRAMES;
          } else {
            // Move
            const currentSpeed = wc.speedBoost ? wc.speed * 2.5 : wc.speed;
            if (wc.direction === "right") {
              wc.x += currentSpeed;
              if (wc.x > window.innerWidth - CREATURE_WIDTH) {
                wc.isStopped = true;
                wc.stopTimer = STOP_FRAMES;
              }
            } else {
              wc.x -= currentSpeed;
              if (wc.x < 0) {
                wc.isStopped = true;
                wc.stopTimer = STOP_FRAMES;
              }
            }
          }
        }

        // Update DOM directly
        const el = domRefs.current.get(wc.creature.id);
        if (el) {
          el.style.left = `${wc.x}px`;
          el.style.transform = `scaleX(${wc.direction === "left" ? -1 : 1})`;

          // Update jump on inner wrapper
          const inner = el.firstElementChild as HTMLElement | null;
          if (inner) {
            inner.style.transform = `translateY(${wc.isJumping ? `-${JUMP_HEIGHT}px` : "0px"})`;
          }
        }

        // Update exclamation visibility
        const excEl = exclamationRefs.current.get(wc.creature.id);
        if (excEl) {
          excEl.style.display = wc.showExclamation ? "block" : "none";
          if (wc.showExclamation) {
            excEl.style.animation =
              wc.exclamationTimer > 15
                ? "exclamation-appear 0.15s ease-out forwards"
                : "exclamation-fade 0.5s ease-out forwards";
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [creatureIds]);

  const handleClick = useCallback((creatureId: number) => {
    const wc = stateRef.current.find((w) => w.creature.id === creatureId);
    if (wc) {
      wc.isJumping = true;
      wc.jumpTimer = 20;
      wc.speedBoost = true;
      wc.speedBoostTimer = 300;
      wc.showExclamation = true;
      wc.exclamationTimer = 45;
    }
  }, []);

  if (creatureIds.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: `${BOTTOM_OFFSET}px`,
        left: 0,
        width: "100%",
        height: `${CONTAINER_HEIGHT}px`,
        zIndex: 1000,
        overflow: "visible",
      }}
    >
      {stateRef.current.map((wc) => (
        <div
          key={wc.creature.id}
          ref={(el) => {
            if (el) domRefs.current.set(wc.creature.id, el);
          }}
          onClick={() => handleClick(wc.creature.id)}
          role="button"
          aria-label={`Creature #${wc.creature.id}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleClick(wc.creature.id);
          }}
          style={{
            position: "absolute",
            bottom: "0px",
            left: `${wc.x}px`,
            height: `${CONTAINER_HEIGHT}px`,
            width: `${CREATURE_WIDTH}px`,
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
              transform: `translateY(${wc.isJumping ? `-${JUMP_HEIGHT}px` : "0px"})`,
              transition: "transform 0.2s ease-out",
              overflow: "visible",
            }}
          >
            <div
              style={{
                transform: `scale(${CREATURE_SCALE})`,
                transformOrigin: "center center",
                height: `${CONTAINER_HEIGHT}px`,
                justifyContent: "center",
                position: "relative",
                overflow: "visible",
              }}
            >
              <CreatureRenderer creature={wc.creature} isWalking={true} />

              <img
                ref={(el) => {
                  if (el) exclamationRefs.current.set(wc.creature.id, el);
                }}
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
                  display: wc.showExclamation ? "block" : "none",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
