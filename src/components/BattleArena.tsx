import React, { useState, useEffect, useRef } from "react";
import { Button, Text } from "@stellar/design-system";
import { CreatureRenderer } from "./CreatureRenderer";
import type { Creature } from "gene_splicer";

interface BattleArenaProps {
  playerCreature: Creature;
  onExit: () => void;
}

type AttackType = "punch" | "kick" | "headbutt";

interface BattleState {
  phase: "intro" | "fighting" | "victory" | "defeat";
  playerHP: number;
  enemyHP: number;
  playerAttacking: boolean;
  enemyAttacking: boolean;
  battleLog: string[];
  isPlayerTurn: boolean;
  playerAttackType: AttackType;
  enemyAttackType: AttackType;
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  playerCreature,
  onExit,
}) => {
  const [enemyCreature, setEnemyCreature] = useState<Creature | null>(null);
  const [arenaImage, setArenaImage] = useState<string>("");

  // Helper to randomly select attack type
  const getRandomAttackType = (): AttackType => {
    const attacks: AttackType[] = ["punch", "kick", "headbutt"];
    return attacks[Math.floor(Math.random() * attacks.length)];
  };

  const [battle, setBattle] = useState<BattleState>({
    phase: "intro",
    playerHP: 100,
    enemyHP: 100,
    playerAttacking: false,
    enemyAttacking: false,
    battleLog: ["The battle begins..."],
    isPlayerTurn: true,
    playerAttackType: "punch",
    enemyAttackType: "punch",
  });

  const battleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const enemyAttackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isExecutingTurnRef = useRef<boolean>(false);
  const hasScheduledEnemyAttackRef = useRef<boolean>(false);

  // Calculate power level
  const calculatePower = (creature: Creature): number => {
    const rarityToPower: Record<string, number> = {
      normal: 3,
      rare: 6,
      legendary: 10,
    };
    return (
      (rarityToPower[creature.head_gene.rarity.tag.toLowerCase()] || 3) +
      (rarityToPower[creature.body_gene.rarity.tag.toLowerCase()] || 3) +
      (rarityToPower[creature.legs_gene.rarity.tag.toLowerCase()] || 3)
    );
  };

  // Generate random enemy creature and select arena
  useEffect(() => {
    // Randomly select arena
    const arenas = ["arena1.png", "arena2.png", "arena3.png"];
    const selectedArena = arenas[Math.floor(Math.random() * arenas.length)];
    setArenaImage(`/assets/arenas/${selectedArena}`);

    // Generate a random gene with correct rarity based on gene ID
    // Per spec: Legendary (3-5), Rare (0-2), Normal (6-14)
    const randomGene = () => {
      const roll = Math.random();
      let id: number;
      let rarity: { tag: "Legendary" | "Rare" | "Normal"; values: never };

      if (roll < 0.1) {
        // Legendary: Golem (gene IDs 3-5)
        id = 3 + Math.floor(Math.random() * 3);
        rarity = { tag: "Legendary" as const, values: undefined as never };
      } else if (roll < 0.4) {
        // Rare: Dark Oracle (gene IDs 0-2)
        id = Math.floor(Math.random() * 3);
        rarity = { tag: "Rare" as const, values: undefined as never };
      } else {
        // Normal: Necromancer, Skeleton Crusader, Skeleton Warrior (gene IDs 6-14)
        id = 6 + Math.floor(Math.random() * 9);
        rarity = { tag: "Normal" as const, values: undefined as never };
      }

      return { id, rarity };
    };

    const enemy: Creature = {
      id: 999,
      owner: "",
      skin_id: Math.floor(Math.random() * 10),
      head_gene: randomGene(),
      body_gene: randomGene(),
      legs_gene: randomGene(),
      entropy_round: BigInt(0),
      finalized_at: BigInt(Date.now()),
    };

    setEnemyCreature(enemy);

    // Start battle after intro animation
    setTimeout(() => {
      setBattle((prev) => ({ ...prev, phase: "fighting" }));
    }, 1200);
  }, []);

  // Battle logic
  useEffect(() => {
    if (battle.phase !== "fighting" || !enemyCreature) {
      // Clear any existing interval and timeout if battle is not in fighting phase
      console.log(`[BATTLE] Phase is ${battle.phase}, clearing timers`);
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
        battleIntervalRef.current = null;
      }
      if (enemyAttackTimeoutRef.current) {
        clearTimeout(enemyAttackTimeoutRef.current);
        enemyAttackTimeoutRef.current = null;
      }
      return;
    }

    console.log(`[BATTLE] Starting battle loop, phase: ${battle.phase}`);

    // Clear any existing timers before setting up new ones
    if (battleIntervalRef.current) {
      console.log(
        `[BATTLE] Clearing existing interval before creating new one`,
      );
      clearInterval(battleIntervalRef.current);
      battleIntervalRef.current = null;
    }
    if (enemyAttackTimeoutRef.current) {
      console.log(`[BATTLE] Clearing existing timeout before creating new one`);
      clearTimeout(enemyAttackTimeoutRef.current);
      enemyAttackTimeoutRef.current = null;
    }

    const playerPower = calculatePower(playerCreature);
    const enemyPower = calculatePower(enemyCreature);

    const executeBattleTurn = () => {
      console.log(`[BATTLE] executeBattleTurn called`);

      // Guard: Prevent concurrent execution
      if (isExecutingTurnRef.current) {
        console.log(`[BATTLE] Already executing a turn, skipping`);
        return;
      }

      isExecutingTurnRef.current = true;
      console.log(`[BATTLE] Set isExecutingTurnRef to true`);

      // Calculate attack type and damage OUTSIDE setState so both executions use same values
      const attackType = getRandomAttackType();
      const playerDamage = Math.ceil(playerPower * (0.8 + Math.random() * 0.4));

      setBattle((prev) => {
        // Guard: Don't execute if battle is over
        if (prev.phase !== "fighting") {
          console.log(
            `[BATTLE] executeBattleTurn called but phase is ${prev.phase}, skipping`,
          );
          isExecutingTurnRef.current = false;
          return prev;
        }

        // Guard: Only execute on player turn
        if (!prev.isPlayerTurn) {
          console.log(`[BATTLE] Not player turn, skipping`);
          isExecutingTurnRef.current = false;
          return prev;
        }

        if (prev.isPlayerTurn) {
          console.log(`[BATTLE] === PLAYER TURN START ===`);
          console.log(
            `[BATTLE] Player HP: ${prev.playerHP}, Enemy HP: ${prev.enemyHP}`,
          );

          // Use pre-calculated attack type and damage
          const newEnemyHP = Math.max(0, prev.enemyHP - playerDamage);

          console.log(
            `[BATTLE] Player ${attackType} attack deals ${playerDamage} damage`,
          );
          console.log(`[BATTLE] Enemy HP: ${prev.enemyHP} -> ${newEnemyHP}`);

          const attackVerb =
            attackType === "punch"
              ? "punches"
              : attackType === "kick"
                ? "kicks"
                : "headbutts";
          const newLog = [
            `Your creature ${attackVerb} for ${playerDamage} damage!`,
            ...prev.battleLog,
          ].slice(0, 5);

          // Check if enemy defeated
          if (newEnemyHP <= 0) {
            console.log(`[BATTLE] VICTORY! Enemy defeated!`);
            console.log(`[BATTLE] Clearing interval immediately`);
            if (battleIntervalRef.current) {
              clearInterval(battleIntervalRef.current);
              battleIntervalRef.current = null;
            }
            if (enemyAttackTimeoutRef.current) {
              clearTimeout(enemyAttackTimeoutRef.current);
              enemyAttackTimeoutRef.current = null;
            }
            isExecutingTurnRef.current = false;
            hasScheduledEnemyAttackRef.current = false;

            // Use setTimeout to reset player to idle after attack animation completes
            setTimeout(() => {
              setBattle((prev3) => {
                if (prev3.phase === "victory") {
                  console.log(
                    `[BATTLE] Resetting player to idle after victory`,
                  );
                  return { ...prev3, playerAttacking: false };
                }
                return prev3;
              });
            }, 400); // Match attack animation duration

            return {
              ...prev,
              enemyHP: 0,
              phase: "victory",
              battleLog: ["Victory! Enemy defeated!", ...newLog],
              playerAttacking: true,
              isPlayerTurn: false,
              playerAttackType: attackType,
            };
          }

          // Only schedule enemy attack timeout once (React Strict Mode calls this callback twice)
          if (!hasScheduledEnemyAttackRef.current) {
            hasScheduledEnemyAttackRef.current = true;
            console.log(`[BATTLE] Scheduling enemy attack in 800ms`);

            // Schedule enemy attack after delay
            enemyAttackTimeoutRef.current = setTimeout(() => {
              console.log(`[BATTLE] === ENEMY TURN START ===`);

              // Calculate enemy attack type and damage OUTSIDE setState so both executions use same values
              const enemyAttackType = getRandomAttackType();
              const enemyDamage = Math.ceil(
                enemyPower * (0.8 + Math.random() * 0.4),
              );

              setBattle((prev2) => {
                // Guard: Don't execute if battle is over
                if (prev2.phase !== "fighting") {
                  console.log(
                    `[BATTLE] Enemy attack timeout fired but phase is ${prev2.phase}, skipping`,
                  );
                  return prev2;
                }

                console.log(
                  `[BATTLE] Player HP: ${prev2.playerHP}, Enemy HP: ${prev2.enemyHP}`,
                );

                // Use pre-calculated enemy attack type and damage
                const newPlayerHP = Math.max(0, prev2.playerHP - enemyDamage);

                console.log(
                  `[BATTLE] Enemy ${enemyAttackType} attack deals ${enemyDamage} damage`,
                );
                console.log(
                  `[BATTLE] Player HP: ${prev2.playerHP} -> ${newPlayerHP}`,
                );

                const attackVerb =
                  enemyAttackType === "punch"
                    ? "punches"
                    : enemyAttackType === "kick"
                      ? "kicks"
                      : "headbutts";
                const newLog = [
                  `Enemy ${attackVerb} for ${enemyDamage} damage!`,
                  ...prev2.battleLog,
                ].slice(0, 5);

                // Check if player defeated
                if (newPlayerHP <= 0) {
                  console.log(`[BATTLE] DEFEAT! Player creature defeated!`);
                  console.log(`[BATTLE] Clearing interval immediately`);
                  if (battleIntervalRef.current) {
                    clearInterval(battleIntervalRef.current);
                    battleIntervalRef.current = null;
                  }
                  if (enemyAttackTimeoutRef.current) {
                    clearTimeout(enemyAttackTimeoutRef.current);
                    enemyAttackTimeoutRef.current = null;
                  }
                  isExecutingTurnRef.current = false;
                  hasScheduledEnemyAttackRef.current = false;

                  // Use setTimeout to reset enemy to idle after attack animation completes
                  setTimeout(() => {
                    setBattle((prev3) => {
                      if (prev3.phase === "defeat") {
                        console.log(
                          `[BATTLE] Resetting enemy to idle after victory`,
                        );
                        return { ...prev3, enemyAttacking: false };
                      }
                      return prev3;
                    });
                  }, 400); // Match attack animation duration

                  return {
                    ...prev2,
                    playerHP: 0,
                    phase: "defeat",
                    battleLog: [
                      "Defeat! Your creature was beaten...",
                      ...newLog,
                    ],
                    enemyAttacking: true,
                    isPlayerTurn: true,
                    enemyAttackType: enemyAttackType,
                  };
                }

                console.log(`[BATTLE] === TURN COMPLETE ===\n`);
                console.log(
                  `[BATTLE] Resetting isExecutingTurnRef and hasScheduledEnemyAttackRef to false`,
                );
                isExecutingTurnRef.current = false;
                hasScheduledEnemyAttackRef.current = false;
                return {
                  ...prev2,
                  playerHP: newPlayerHP,
                  battleLog: newLog,
                  playerAttacking: false,
                  enemyAttacking: true,
                  isPlayerTurn: true,
                  enemyAttackType: enemyAttackType,
                };
              });
            }, 800);
          }

          return {
            ...prev,
            enemyHP: newEnemyHP,
            battleLog: newLog,
            playerAttacking: true,
            enemyAttacking: false,
            isPlayerTurn: false,
            playerAttackType: attackType,
          };
        }
        return prev;
      });
    };

    battleIntervalRef.current = setInterval(executeBattleTurn, 1600);

    return () => {
      if (battleIntervalRef.current) {
        clearInterval(battleIntervalRef.current);
      }
      if (enemyAttackTimeoutRef.current) {
        clearTimeout(enemyAttackTimeoutRef.current);
      }
    };
  }, [battle.phase, playerCreature, enemyCreature]);

  if (!enemyCreature) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "#000",
        backgroundImage: arenaImage ? `url(${arenaImage})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        animation: "battleExpand 0.5s ease-out, fadeIn 1s ease-in",
        overflow: "hidden",
      }}
    >
      <style>
        {`
          @keyframes battleExpand {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }

          @keyframes slideInRight {
            from {
              transform: translateX(-100vw);
            }
            to {
              transform: translateX(0);
            }
          }

          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }

          @keyframes shakePlayer {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
          }

          @keyframes punchPlayer {
            0% { transform: translateX(0); }
            30% { transform: translateX(40px); }
            60% { transform: translateX(40px); }
            100% { transform: translateX(0); }
          }

          @keyframes punchEnemy {
            0% { transform: translateX(0); }
            30% { transform: translateX(40px); }
            60% { transform: translateX(40px); }
            100% { transform: translateX(0); }
          }

          @keyframes kickPlayer {
            0% { transform: translateX(0) translateY(0); }
            30% { transform: translateX(50px) translateY(-10px); }
            60% { transform: translateX(50px) translateY(-10px); }
            100% { transform: translateX(0) translateY(0); }
          }

          @keyframes kickEnemy {
            0% { transform: translateX(0) translateY(0); }
            30% { transform: translateX(50px) translateY(-10px); }
            60% { transform: translateX(50px) translateY(-10px); }
            100% { transform: translateX(0) translateY(0); }
          }

          @keyframes headbuttPlayer {
            0% { transform: translateX(0) translateY(0) rotate(0deg); }
            20% { transform: translateX(20px) translateY(-20px) rotate(15deg); }
            40% { transform: translateX(60px) translateY(10px) rotate(15deg); }
            70% { transform: translateX(60px) translateY(10px) rotate(15deg); }
            100% { transform: translateX(0) translateY(0) rotate(0deg); }
          }

          @keyframes headbuttEnemy {
            0% { transform: translateX(0) translateY(0) rotate(0deg); }
            20% { transform: translateX(20px) translateY(-20px) rotate(15deg); }
            40% { transform: translateX(60px) translateY(10px) rotate(15deg); }
            70% { transform: translateX(60px) translateY(10px) rotate(15deg); }
            100% { transform: translateX(0) translateY(0) rotate(0deg); }
          }

          @keyframes attackFlash {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(2) drop-shadow(0 0 20px #ff0000); }
          }

          @keyframes healthDrain {
            from { width: var(--start-width); }
            to { width: var(--end-width); }
          }

          @keyframes knockout {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            30% {
              transform: translateY(-20px) rotate(-10deg);
              opacity: 1;
            }
            100% {
              transform: translateY(150px) rotate(-90deg);
              opacity: 0.2;
            }
          }

          @keyframes victoryPop {
            0% {
              transform: scale(0) rotate(-10deg);
              opacity: 0;
            }
            50% {
              transform: scale(1.2) rotate(5deg);
            }
            70% {
              transform: scale(0.9) rotate(-2deg);
            }
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }

          @keyframes victoryPulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.05);
              filter: brightness(1.2);
            }
          }

          @keyframes victoryShine {
            0% {
              background-position: -200% center;
            }
            100% {
              background-position: 200% center;
            }
          }

          @keyframes defeatPop {
            0% {
              transform: scale(0) rotate(-10deg);
              opacity: 0;
            }
            50% {
              transform: scale(1.2) rotate(5deg);
            }
            70% {
              transform: scale(0.9) rotate(-2deg);
            }
            100% {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }

          @keyframes defeatPulse {
            0%, 100% {
              transform: scale(1);
              filter: brightness(1);
            }
            50% {
              transform: scale(1.05);
              filter: brightness(1.2);
            }
          }
        `}
      </style>

      {/* Health bars */}
      <div
        style={{
          position: "absolute",
          top: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: "1000px",
          display: "flex",
          justifyContent: "space-between",
          gap: "4rem",
          zIndex: 10,
        }}
      >
        {/* Player health */}
        <div style={{ flex: 1 }}>
          <Text
            as="p"
            size="sm"
            style={{
              color: "#4ade80",
              marginBottom: "0.5rem",
              fontWeight: "bold",
            }}
          >
            YOUR CREATURE - POWER: {calculatePower(playerCreature)}
          </Text>
          <div
            style={{
              width: "100%",
              height: "30px",
              backgroundColor: "#2a2a2a",
              border: "3px solid #4ade80",
              borderRadius: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${battle.playerHP}%`,
                height: "100%",
                backgroundColor: "#4ade80",
                transition: "width 0.3s ease",
                boxShadow: "inset 0 0 10px rgba(74, 222, 128, 0.5)",
              }}
            />
            <Text
              as="p"
              size="sm"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "#fff",
                fontWeight: "bold",
                textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              {battle.playerHP} / 100
            </Text>
          </div>
        </div>

        {/* Enemy health */}
        <div style={{ flex: 1 }}>
          <Text
            as="p"
            size="sm"
            style={{
              color: "#ef4444",
              marginBottom: "0.5rem",
              fontWeight: "bold",
            }}
          >
            ENEMY CREATURE - POWER: {calculatePower(enemyCreature)}
          </Text>
          <div
            style={{
              width: "100%",
              height: "30px",
              backgroundColor: "#2a2a2a",
              border: "3px solid #ef4444",
              borderRadius: 0,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${battle.enemyHP}%`,
                height: "100%",
                backgroundColor: "#ef4444",
                transition: "width 0.3s ease",
                boxShadow: "inset 0 0 10px rgba(239, 68, 68, 0.5)",
              }}
            />
            <Text
              as="p"
              size="sm"
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                color: "#fff",
                fontWeight: "bold",
                textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              {battle.enemyHP} / 100
            </Text>
          </div>
        </div>
      </div>

      {/* Battle arena */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "90%",
          maxWidth: "1200px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "2rem",
        }}
      >
        {/* Player creature */}
        <div
          style={{
            flex: "0 0 auto",
            animation:
              battle.phase === "defeat"
                ? "knockout 0.8s ease-out forwards"
                : battle.playerAttacking
                  ? `${battle.playerAttackType}Player 0.4s ease-out`
                  : "none",
            filter: battle.playerAttacking
              ? "brightness(1.3) drop-shadow(0 0 30px #4ade80)"
              : "brightness(1)",
            transition: "filter 0.2s",
          }}
        >
          <div
            style={{
              width: "300px",
              height: "420px",
              paddingTop: "60px",
            }}
          >
            <CreatureRenderer
              creature={playerCreature}
              isAttacking={battle.playerAttacking}
              attackType={battle.playerAttackType}
              isKnockedOut={battle.phase === "defeat"}
            />
          </div>
        </div>

        {/* VS indicator */}
        <div
          style={{
            flex: "0 0 auto",
            fontSize: "4rem",
            fontWeight: "bold",
            color: "#fff",
            textShadow: "0 0 20px rgba(255,255,255,0.5)",
            animation: "pulse 2s infinite",
          }}
        >
          VS
        </div>

        {/* Enemy creature - wrapper with flip */}
        <div
          style={{
            flex: "0 0 auto",
            transform: "scaleX(-1)",
          }}
        >
          <div
            style={{
              animation:
                battle.phase === "victory"
                  ? "knockout 0.8s ease-out forwards"
                  : battle.phase === "intro"
                    ? "slideInRight 1s ease-out"
                    : battle.enemyAttacking
                      ? `${battle.enemyAttackType}Enemy 0.4s ease-out`
                      : "none",
              filter: battle.enemyAttacking
                ? "brightness(1.3) drop-shadow(0 0 30px #ef4444)"
                : "brightness(1)",
              transition: "filter 0.2s",
            }}
          >
            <div
              style={{
                width: "300px",
                height: "420px",
                paddingTop: "60px",
              }}
            >
              <CreatureRenderer
                creature={enemyCreature}
                isAttacking={battle.enemyAttacking}
                attackType={battle.enemyAttackType}
                isKnockedOut={battle.phase === "victory"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Battle log */}
      <div
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          maxWidth: "600px",
          backgroundColor: "rgba(0,0,0,0.8)",
          border: "2px solid #666",
          borderRadius: 0,
          padding: "1rem",
        }}
      >
        {battle.battleLog.map((log, index) => (
          <Text
            // eslint-disable-next-line react-x/no-array-index-key
            key={`${index}-${log}`}
            as="p"
            size="sm"
            style={{
              color: "#fff",
              marginBottom: "0.25rem",
              opacity: 1 - index * 0.05,
            }}
          >
            {log}
          </Text>
        ))}
      </div>

      {/* Victory/Defeat overlay */}
      {(battle.phase === "victory" || battle.phase === "defeat") && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.5s",
            zIndex: 100,
          }}
        >
          <Text
            as="h1"
            size="xl"
            style={{
              fontSize: "6rem",
              fontWeight: "900",
              color: battle.phase === "victory" ? "#ffd700" : "#ef4444",
              marginBottom: "5rem",
              textShadow:
                battle.phase === "victory"
                  ? "0 5px 0 #cc9900, 0 10px 0 #aa7700, 0 15px 0 #886600, 0 20px 20px rgba(0,0,0,0.5)"
                  : "0 5px 0 #991b1b, 0 10px 0 #aa1b1b, 0 15px 0 #881b1b, 0 20px 20px rgba(0,0,0,0.5)",
              filter:
                battle.phase === "victory"
                  ? "drop-shadow(0 0 30px #ffd700) drop-shadow(0 0 60px #ffed4e)"
                  : "drop-shadow(0 0 30px #ef4444) drop-shadow(0 0 60px #dc2626)",
              animation:
                battle.phase === "victory"
                  ? "victoryPop 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards, victoryPulse 2s ease-in-out infinite 0.8s"
                  : "defeatPop 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards, defeatPulse 2s ease-in-out infinite 0.8s",
              transform: "perspective(500px) rotateX(10deg) translateZ(0)",
              letterSpacing: "0.1em",
              willChange: "transform, filter",
              backfaceVisibility: "hidden",
              WebkitFontSmoothing: "antialiased",
              MozOsxFontSmoothing: "grayscale",
            }}
          >
            {battle.phase === "victory" ? "VICTORY!" : "DEFEAT!"}
          </Text>
          <Button
            size="md"
            variant="primary"
            onClick={onExit}
            style={{
              fontSize: "1.5rem",
              padding: "1rem 3rem",
            }}
          >
            Return to Collection
          </Button>
        </div>
      )}
    </div>
  );
};
