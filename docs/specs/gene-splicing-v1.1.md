# Gene Splicing — Soroban NFT Game Specification v1.1

## Version History

- **v1.0**: Initial specification with basic splicing, drand entropy, BLS12-381 verification
- **v1.1**: Current implementation + planned features (NFT metadata, PvP battles, items, abilities, creature fusion, lore)

---

## Premise

The surface world is lost. In subterranean bunkers, survivors fuse genes and print monsters — the ultimate fighters, born to reclaim the world that once was.

Players splice genetic sequences to create unique creatures, each with distinct parts, rarities, and combat capabilities. The game combines NFT ownership with turn-based battles, strategic itemization, and deep lore-driven storytelling.

---

## Core Game Loop (Current Implementation)

### 1. Splice Genome

- Player pays 1 XLM fee (transferred to admin via Stellar Asset Contract)
- Contract mints **Genome Cartridge NFT** (pending creature)
- Soroban PRNG selects cosmetic skin (10 variants)
- Records drand round number (`splice_round`) for entropy lookup

### 2. Submit Entropy (Permissionless)

- **Client-side**: User fetches drand quicknet randomness from browser
- **Decompression**: BLS12-381 G1 signature (48→96 bytes) via `@noble/curves`
- **Contract verification** (CAP-0059):
  - Deserializes G1Affine/G2Affine using `from_bytes()`
  - Verifies subgroup membership (`g1_is_in_subgroup`, `g2_is_in_subgroup`)
  - Constructs drand message: `prev_signature || round_bytes` (big-endian)
  - Performs on-chain Hash-to-Curve (H2C): `hash_to_g1()` with DST `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`
  - Verifies pairing equation: `e(signature, G2_gen) == e(hashed_message, drand_pubkey)`
- Stores verified entropy for round

### 3. Finalize Splice (Permissionless)

- Fetches entropy for cartridge's `splice_round` (or earliest later round)
- Uses entropy as PRNG seed for weighted gene selection:
  - **Legendary** (10%): Gene IDs 3-5 (Golem)
  - **Rare** (30%): Gene IDs 0-2 (Dark Oracle)
  - **Normal** (60%): Gene IDs 6-14 (Necromancer, Skeleton Crusader, Skeleton Warrior)
- Generates 3 genes: `head_gene`, `torso_gene`, `legs_gene`
- Mints **Creature NFT** with gene data
- Burns Genome Cartridge NFT

---

## Creature Data Structure (Current)

```rust
pub struct Creature {
    pub id: u32,
    pub owner: Address,
    pub skin_id: u32,              // Cosmetic variant (0-9)
    pub entropy_round: u64,         // Drand round used for finalization
    pub finalized_at: u64,          // Ledger timestamp
    pub head_gene: Gene,
    pub torso_gene: Gene,
    pub legs_gene: Gene,
}

pub struct Gene {
    pub id: u32,                    // 0-14 (maps to creature type/variant)
    pub rarity: GeneRarity,         // Normal, Rare, Legendary
}

pub enum GeneRarity {
    Normal,    // 60% - IDs 6-14
    Rare,      // 30% - IDs 0-2
    Legendary, // 10% - IDs 3-5
}
```

---

## Gene ID Mapping (Current Assets)

### Creature Types & Rarities

| Rarity    | Creature Type     | Gene IDs | Percentage |
| --------- | ----------------- | -------- | ---------- |
| Legendary | Golem             | 3-5      | 10%        |
| Rare      | Dark Oracle       | 0-2      | 30%        |
| Normal    | Necromancer       | 6-8      | 20%        |
| Normal    | Skeleton Crusader | 9-11     | 20%        |
| Normal    | Skeleton Warrior  | 12-14    | 20%        |

### Visual Assets

- **Location**: `public/assets/creatures/`
- **Body Parts**: `heads/`, `eyes/`, `faces/`, `torsos/`, `arms/`, `feet/`
- **Naming**: `{part}-{id}.png` (e.g., `head-0.png` through `head-14.png`)
- **Rendering**: Client-side PNG layering (6 layers per creature)
- **Dimensions**: 256x256px per layer (scaled to 512x512px in UI)
- **Format**: PNG with transparency (alpha channel)
- **Art Style**: Pixel art with hand-drawn details, dark fantasy aesthetic

**Current Asset Status**:

- **Placeholder Art**: Initial assets are placeholder/test images
- **Planned Expansion**: Full original artwork with:
  - Distinct visual identity per creature type
  - Rarity-based visual effects (glows, particles, auras)
  - Animation frames for battle system
  - High-resolution alternatives for NFT metadata (1024x1024px)

---

## Genome Cartridge Skins System

**Overview**: When a player calls `splice_genome()`, the contract uses Soroban's PRNG to assign a cosmetic skin variant (0-9) to the Genome Cartridge NFT. This skin determines the visual appearance of the cartridge before finalization.

### Skin Selection

**PRNG Mechanism**:

```rust
// In splice_genome()
let skin_id = env.prng().gen_range(0..cartridge_skin_count); // 0-9
```

- **Seed Source**: Soroban's `env.prng()` (ledger-based randomness)
- **Range**: 0-9 (10 total variants)
- **Deterministic**: Same seed = same skin (reproducible)
- **Non-security-critical**: Cosmetic only, does not affect gene rarity

### Skin Variants (Planned)

| Skin ID | Name              | Description                        | Visual Theme           |
| ------- | ----------------- | ---------------------------------- | ---------------------- |
| 0       | Rusted Iron       | Standard issue, worn and weathered | Gray/brown tones       |
| 1       | Crimson Vial      | Blood-infused cartridge            | Deep red, glowing      |
| 2       | Jade Shard        | Ancient relic from the old world   | Green crystalline      |
| 3       | Shadow Essence    | Dark matter contained in glass     | Black with purple aura |
| 4       | Golden Core       | Rare prototype cartridge           | Gold metallic sheen    |
| 5       | Frost Sealed      | Cryogenic preservation container   | Ice blue, frosted      |
| 6       | Molten Heart      | Lava-infused genetic material      | Orange/red glow        |
| 7       | Void Crystal      | Spacetime-warped cartridge         | Purple/black fractal   |
| 8       | Bio-Luminescent   | Glowing organic material           | Green/cyan biolume     |
| 9       | Obsidian Monolith | Indestructible dark stone          | Black obsidian         |

**Asset Requirements**:

- **Location**: `public/assets/cartridges/`
- **Naming**: `cartridge-{skin_id}.png` (e.g., `cartridge-0.png`)
- **Dimensions**: 200x300px (portrait orientation, vial/cartridge shape)
- **Format**: PNG with transparency, animated variants (WebP/APNG)
- **Effects**: Optional particle effects, glow layers, animated gradients

### Skin Persistence

- **Storage**: Skin ID stored in `GenomeCartridge` struct
- **Transfer**: When cartridge is finalized, skin becomes part of creature metadata
- **NFT Metadata**: Cartridge skin included in IPFS metadata JSON
- **UI Display**: Cartridge shown in inventory before finalization with its skin

### Future Enhancements

**Rare Skin Drops**:

- **Legendary Skins** (1% chance): Special animated cartridges with enhanced VFX
- **Event Skins**: Limited edition cartridges for special occasions
- **Skin Marketplace**: Trade cartridges for desired skins before finalization

**Skin Effects on Creatures**:

- Cosmetic influence: Creature's color palette slightly influenced by cartridge skin
- Example: Golden Core cartridge → creature has gold accents in final render
- Does NOT affect stats or abilities (purely cosmetic)

---

## Current Tech Stack

- **Smart Contracts**: Rust + Soroban SDK (WASM)
- **Frontend**: React + TypeScript + Vite
- **Deployment**: GitHub Pages (static site)
- **Blockchain**: Stellar Soroban (testnet)
- **Entropy**: Drand Quicknet (3-second rounds)
- **Contract Library**: OpenZeppelin Stellar Contracts

---

## Planned Features (v1.1+)

### 1. NFT Metadata Pinning (IPFS)

**Goal**: Generate canonical NFT metadata for each creature, pinned to IPFS via Pinata.

**Implementation**:

- **Service Worker**: Background worker monitors finalized creatures
- **Image Generation**: Composite PNG from 6-layer creature assets
- **Metadata Structure**:
  ```json
  {
    "name": "Creature #123",
    "description": "A Legendary Golem fused with Dark Oracle torso",
    "image": "ipfs://QmXxx.../creature-123.png",
    "attributes": [
      { "trait_type": "Head", "value": "Golem Head #3" },
      { "trait_type": "Head Rarity", "value": "Legendary" },
      { "trait_type": "Torso", "value": "Dark Oracle Torso #1" },
      { "trait_type": "Torso Rarity", "value": "Rare" },
      { "trait_type": "Legs", "value": "Necromancer Legs #7" },
      { "trait_type": "Legs Rarity", "value": "Normal" },
      { "trait_type": "Power Level", "value": 145 },
      { "trait_type": "Generation", "value": 1 }
    ],
    "external_url": "https://splicers.net/creature/123"
  }
  ```

**Pinning Strategy**:

1. **Individual Parts**: Pin each gene asset once (reusable across creatures)
2. **Composite Creature**: Generate and pin full creature image on finalization
3. **Metadata JSON**: Pin metadata referencing both IPFS hashes
4. **On-Chain Storage**: Optionally store metadata CID in contract (future upgrade)

**Service Architecture**:

- **Trigger**: Poll contract events or user-initiated finalization
- **Processing**: Fetch gene data → composite image → upload to Pinata
- **Caching**: Store IPFS hashes to avoid duplicate uploads
- **Rate Limiting**: Respect Pinata API limits (queue system)

---

### 2. Player vs Player (PvP) Battles

**Core Mechanics**:

**Battle Stats** (derived from genes):

- **Health Points (HP)**: Base 100 + rarity bonuses
  - Normal: +0 HP
  - Rare: +20 HP
  - Legendary: +50 HP
- **Attack Power**: Base 10 + part-specific bonuses
- **Defense**: Reduces incoming damage
- **Speed**: Determines turn order

**Turn-Based Combat**:

1. **Initiative**: Creature with higher speed attacks first
2. **Attack Phase**: Attacker rolls damage (Attack Power ± randomness)
3. **Defense Phase**: Defender reduces damage by Defense stat
4. **Ability Phase**: Part-specific abilities trigger (see below)
5. **Repeat**: Turns alternate until one creature reaches 0 HP

**Battle Types**:

- **Ranked Matches**: ELO-based matchmaking, leaderboards
- **Casual Battles**: Practice mode, no stakes
- **Tournament Mode**: Bracket-style elimination (future)

**Rewards**:

- **Victory**: XP, currency (XLM or game token), battle loot crates
- **Loss**: Smaller XP reward, no loot
- **Streak Bonuses**: Consecutive wins increase rewards

**Contract Integration**:

- Store battle outcomes on-chain (gas-optimized)
- Maintain per-creature win/loss records
- Calculate ELO ratings
- Emit events for frontend leaderboards

---

### 3. Items & Equipment System

**Item Types**:

**Weapons** (attach to creatures):

- **Bone Sword**: +15 Attack, 5% crit chance
- **Necro Staff**: +10 Attack, +10 Defense, drains 5 HP per turn
- **Golem Fists**: +20 Attack, reduces speed by 10%

**Armor**:

- **Corrupted Plate**: +30 Defense, immune to poison
- **Shadow Cloak**: +15 Defense, +20% evasion
- **Crystal Shield**: Reflects 10% damage back to attacker

**Consumables** (single-use):

- **Healing Potion**: Restore 50 HP mid-battle
- **Rage Serum**: +50% Attack for 3 turns
- **Speed Elixir**: Double speed for 2 turns

**Attachments** (permanent upgrades):

- **Rune of Power**: +5% to all stats
- **Essence of Legends**: Upgrades one gene rarity (Normal→Rare)

**Item Acquisition**:

- **Battle Loot**: Random drops after victories
- **Crafting**: Combine materials from dismantled creatures
- **Marketplace**: Trade items between players (future)
- **Admin Minting**: Special event items

**Item NFTs**:

- Each item is an on-chain NFT (separate from creatures)
- Creatures have "equipment slots" for attached items
- Items can be unequipped and traded

---

### 4. Part-Based Abilities

**Ability System**:
Each gene has inherent abilities based on creature type and body part.

**Head Abilities** (active, cooldown-based):

- **Golem Head (Legendary)**: **Stone Gaze** - Stun opponent for 1 turn (3-turn cooldown)
- **Dark Oracle Head (Rare)**: **Mind Blast** - 30 damage, bypasses defense (4-turn cooldown)
- **Necromancer Head (Normal)**: **Death Bolt** - 20 damage (2-turn cooldown)
- **Skeleton Warrior Head (Normal)**: **Intimidate** - Reduce enemy attack by 10% for 2 turns

**Torso Abilities** (passive):

- **Golem Torso (Legendary)**: **Rock Solid** - 30% damage reduction
- **Dark Oracle Torso (Rare)**: **Void Aura** - Regenerate 5 HP per turn
- **Skeleton Crusader Torso (Normal)**: **Bone Armor** - 10% damage reduction

**Leg Abilities** (movement/speed):

- **Golem Legs (Legendary)**: **Earthquake Stomp** - 25 AoE damage, stuns for 1 turn (5-turn cooldown)
- **Dark Oracle Legs (Rare)**: **Shadow Step** - +30% evasion for 2 turns
- **Necromancer Legs (Normal)**: **Sprint** - +20% speed for 1 turn

**Synergy Bonuses**:

- **Full Set (3 parts same creature)**: +25% to all stats
- **Rarity Synergy (3 Legendary parts)**: Unlock ultimate ability
- **Mixed Set Penalties**: None (encourages experimentation)

**Ultimate Abilities** (full Legendary set):

- **Golem Ultimate**: **Tectonic Slam** - 100 damage, 50% chance to instant-kill
- **Dark Oracle Ultimate**: **Void Collapse** - Drain 50 HP from enemy, heal self for 30

---

### 5. Creature Fusion System

**Concept**: Sacrifice multiple creatures to create a "super creature" with enhanced stats and combined abilities.

**Fusion Mechanics**:

**Requirements**:

- Minimum 2 creatures (max 5)
- All creatures must be owned by same player
- Fusion fee: 2 XLM (to prevent spam)

**Fusion Process**:

1. **Select Fusion Parts**: Choose head from Creature A, torso from Creature B, legs from Creature C
2. **Stat Calculation**: New creature inherits average stats + fusion bonus
   - Base Stats: Average of source creatures
   - Fusion Bonus: +10 HP, +5 Attack, +5 Defense per creature sacrificed
3. **Ability Inheritance**: New creature gains all abilities from selected parts
4. **Rarity Upgrade Chance**:
   - 3+ Rare parts: 25% chance to upgrade one part to Legendary
   - 2 Legendary parts: Guaranteed Legendary final creature
5. **Generation Tracking**: Creature marked as "Generation 2" (or higher)
6. **Source Burning**: All source creatures are burned (NFTs destroyed)

**Super Creature Advantages**:

- **Higher Stats**: Base stats scale with generation
- **Multiple Abilities**: Inherits all abilities from source parts
- **Prestige**: Visible "Gen 2" badge, leaderboard tracking
- **Rarity Stacking**: Legendary parts from multiple creatures combine

**Example Fusion**:

```
Sacrifice:
- Creature #5 (Legendary Golem Head, Rare Torso, Normal Legs)
- Creature #12 (Rare Head, Normal Torso, Legendary Golem Legs)
- Creature #23 (Normal Head, Legendary Golem Torso, Rare Legs)

Result:
- Creature #99 (Generation 2)
  - Head: Legendary Golem (from #5) - Stone Gaze ability
  - Torso: Legendary Golem (from #23) - Rock Solid passive
  - Legs: Legendary Golem (from #12) - Earthquake Stomp ability
  - Stats: HP 250, Attack 40, Defense 35, Speed 15
  - Full Golem Set Bonus: +25% all stats
  - Golem Ultimate: Tectonic Slam unlocked
```

**Contract Functions**:

```rust
pub fn fuse_creatures(
    env: Env,
    owner: Address,
    creature_ids: Vec<u32>,          // Source creatures
    head_from: u32,                   // Which creature to take head from
    torso_from: u32,
    legs_from: u32,
) -> u32;  // Returns new creature ID
```

---

### 6. Lore Animation & Backstory System

**Concept**: Each creature has a rich backstory that unfolds through animated cinematic sequences.

**Lore Structure**:

**Creature Origins** (tied to gene types):

- **Golems**: Ancient guardians awakened from the old world's ruins
- **Dark Oracles**: Seers corrupted by forbidden knowledge
- **Necromancers**: Survivors who mastered death magic to endure
- **Skeleton Warriors**: Fallen soldiers reanimated by necromantic energy
- **Skeleton Crusaders**: Elite knights bound to serve eternally

**Story Beats** (unlocked progressively):

1. **Creation Story** (on finalization):
   - Animated sequence: Gene splicing chamber
   - Cartridge insertion → DNA helix animation → creature emergence
   - Voiceover narration of creature's purpose
   - Duration: 30-45 seconds

2. **First Battle** (after 1st victory):
   - Flashback to surface world destruction
   - Character motivations revealed
   - Duration: 15 seconds

3. **Evolution Story** (on fusion):
   - Dramatic fusion chamber sequence
   - Source creatures merge into super creature
   - New abilities showcase
   - Duration: 60 seconds

4. **Ultimate Unlock** (full Legendary set):
   - Epic cinematic: Creature ascends
   - Reveals creature's true destiny/power
   - Duration: 90 seconds

**Animation System**:

**Technology**:

- **Lottie JSON**: Lightweight vector animations
- **Sprite Sheets**: Pre-rendered creature animations
- **WebGL Shaders**: Dynamic effects (glows, particles)
- **Audio**: Voice acting + cinematic soundtrack

**Triggers**:

- **Automatic**: Plays on key milestones (finalization, fusion)
- **Gallery Mode**: Replayable from creature detail page
- **Skip Option**: Players can skip after first viewing
- **Collectible**: Each animation unlocks a "Memory Fragment" NFT

**Lore Documents** (in-game codex):

- **Journal Entries**: Discover lore through battles
- **Character Bios**: Detailed backstories for each creature type
- **World History**: Timeline of surface world's fall
- **Faction Stories**: Competing survivor factions

**Contract Integration**:

- Store "lore_unlocks" bitmap per creature
- Emit events when new lore is discovered
- Track collection progress for achievements

**Example Lore Entry** (Golem):

> _"Before the fall, we were builders. We raised cities that touched the clouds. When the great cataclysm came, they buried us beneath stone and earth. For centuries we slumbered. Now, awakened by desperate hands, we are no longer builders. We are reclaimers."_

---

## Contract Functions (v1.1)

### Current (Implemented)

```rust
// Core splicing
pub fn splice_genome(env: Env, user: Address) -> u32;
pub fn finalize_splice(env: Env, cartridge_id: u32) -> u32;

// Entropy management
pub fn submit_entropy(env: Env, submitter: Address, round: u64,
                     randomness: Bytes, signature: Bytes);
pub fn get_entropy(env: Env, round: u64) -> Option<Entropy>;

// Queries
pub fn get_cartridge(env: Env, id: u32) -> GenomeCartridge;
pub fn get_creature(env: Env, id: u32) -> Creature;
pub fn get_user_cartridges(env: Env, user: Address) -> Vec<u32>;
pub fn get_user_creatures(env: Env, user: Address) -> Vec<u32>;
```

### Planned (v1.1+)

```rust
// Battle system
pub fn initiate_battle(env: Env, attacker_id: u32, defender_id: u32) -> u32; // Returns battle_id
pub fn execute_turn(env: Env, battle_id: u32, action: BattleAction);
pub fn use_item(env: Env, battle_id: u32, item_id: u32);
pub fn get_battle_state(env: Env, battle_id: u32) -> Battle;

// Items & equipment
pub fn mint_item(env: Env, recipient: Address, item_type: ItemType) -> u32;
pub fn equip_item(env: Env, creature_id: u32, item_id: u32);
pub fn unequip_item(env: Env, creature_id: u32, slot: EquipSlot) -> u32;
pub fn get_creature_equipment(env: Env, creature_id: u32) -> Equipment;

// Fusion
pub fn fuse_creatures(env: Env, owner: Address, creature_ids: Vec<u32>,
                      head_from: u32, torso_from: u32, legs_from: u32) -> u32;

// Lore tracking
pub fn unlock_lore(env: Env, creature_id: u32, lore_id: u32);
pub fn get_unlocked_lore(env: Env, creature_id: u32) -> Vec<u32>;

// Leaderboards
pub fn get_top_creatures(env: Env, limit: u32) -> Vec<LeaderboardEntry>;
pub fn get_player_stats(env: Env, player: Address) -> PlayerStats;
```

---

## Data Structures (Planned)

```rust
pub struct Battle {
    pub id: u32,
    pub attacker_id: u32,
    pub defender_id: u32,
    pub current_turn: u8,
    pub attacker_hp: i32,
    pub defender_hp: i32,
    pub status: BattleStatus,       // InProgress, AttackerWon, DefenderWon
    pub turn_log: Vec<BattleTurn>,
}

pub struct BattleTurn {
    pub actor: u32,                  // creature_id
    pub action: BattleAction,
    pub damage_dealt: i32,
    pub ability_used: Option<u32>,
}

pub enum BattleAction {
    Attack,
    Defend,
    UseAbility(u32),
    UseItem(u32),
    Flee,
}

pub struct Item {
    pub id: u32,
    pub owner: Address,
    pub item_type: ItemType,
    pub rarity: ItemRarity,
    pub stats: ItemStats,
}

pub struct ItemStats {
    pub attack_bonus: i32,
    pub defense_bonus: i32,
    pub hp_bonus: i32,
    pub speed_bonus: i32,
    pub special_effect: Option<SpecialEffect>,
}

pub struct Equipment {
    pub weapon: Option<u32>,         // item_id
    pub armor: Option<u32>,
    pub accessory: Option<u32>,
}

pub struct PlayerStats {
    pub total_battles: u32,
    pub wins: u32,
    pub losses: u32,
    pub elo_rating: u32,
    pub highest_streak: u32,
}
```

---

## Economy & Tokenomics (Future)

**XLM Usage**:

- Splice fee: 1 XLM (current)
- Fusion fee: 2 XLM (planned)
- Battle entry (ranked): 0.1 XLM (planned)

**Potential Game Token** ($SPLICE):

- Earned through battles, achievements, lore completion
- Used for crafting, item purchases, premium features
- Staking for passive rewards
- Governance for game updates

**Revenue Distribution**:

- 60% → Treasury (battle rewards, events)
- 30% → Development fund
- 10% → Burn (deflationary)

---

## Technical Architecture

**Frontend**:

- React 19 + TypeScript
- Vite build system
- Stellar Design System (UI)
- TanStack Query (state management)
- React Router (navigation)

**Smart Contracts**:

- Rust + Soroban SDK
- OpenZeppelin Stellar Contracts
- BLS12-381 cryptography (CAP-0059)
- Storage: Contract data entries + instance storage

**Infrastructure**:

- GitHub Pages (static hosting)
- Pinata (IPFS pinning - planned)
- Service worker (NFT generation - planned)

**Testing**:

- Vitest (unit tests)
- Playwright (E2E tests)
- Cargo test (contract tests)

---

## Branding & Visual Design

### Splicers Logo & Identity

**Logo Concept**:

- **Primary Element**: DNA helix intertwined with mechanical gears
- **Secondary Element**: Broken surface world silhouette above, bunker vault below
- **Typography**: Bold, industrial sans-serif with distressed edges
- **Tagline**: "FORGE THE FUTURE, RECLAIM THE SURFACE"

**Logo Variants**:

- **Full Logo**: Complete wordmark + icon (horizontal layout)
- **Icon Only**: Standalone symbol for favicon, social media
- **Monochrome**: Single-color version for overlays, watermarks
- **Animated**: Glitch effect for loading screens, intros

**Color Palette**:

- **Primary**: `#6e56cf` (Electric purple - success highlights)
- **Secondary**: `#4ade80` (Neon green - success text, accents)
- **Background**: `#1a1a1a` (Deep black - main background)
- **Cards**: `#232323` (Dark gray - elevated surfaces)
- **Borders**: `#333333` (Medium gray - dividers, inputs)
- **Accent**: `#2a2a2a` (Cartridge background)

**Brand Voice**:

- **Tone**: Dystopian, gritty, survival-focused
- **Style**: Terse, technical, urgent
- **Personality**: Authoritative, scientific, slightly ominous
- **Example Copy**: _"The surface is lost. Your creatures are the key. Splice. Fight. Reclaim."_

### Current Implementation Status

**Page Title & Metadata**:

- **Current Title**: "Scaffold Stellar Starter App" ❌ (needs update)
- **Target Title**: "Splicers - Gene Splicing NFT Game"
- **Meta Description**: "Splice genes, forge creatures, and battle for the surface. A Soroban NFT game with verifiable randomness and turn-based combat."
- **OG Tags**: Social media preview cards with logo + hero creature
- **Favicon**: Currently generic ❌ (needs custom Splicers icon)

**Recommended Updates**:

```html
<!-- index.html -->
<head>
  <title>Splicers - Gene Splicing NFT Game</title>
  <meta
    name="description"
    content="Splice genes, forge creatures, and battle for the surface. A Soroban NFT game with verifiable randomness and turn-based combat."
  />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

  <!-- Open Graph -->
  <meta property="og:title" content="Splicers - Gene Splicing NFT Game" />
  <meta
    property="og:description"
    content="Forge the future. Reclaim the surface."
  />
  <meta property="og:image" content="https://splicers.net/og-image.png" />
  <meta property="og:url" content="https://splicers.net" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Splicers - Gene Splicing NFT Game" />
  <meta
    name="twitter:description"
    content="Splice genes, forge creatures, and battle for the surface."
  />
  <meta name="twitter:image" content="https://splicers.net/twitter-card.png" />
</head>
```

**Required Assets**:

- `favicon.ico` (32x32px, classic format)
- `favicon.png` (512x512px, high-res PNG)
- `apple-touch-icon.png` (180x180px, iOS home screen)
- `og-image.png` (1200x630px, social preview)
- `twitter-card.png` (1200x675px, Twitter-optimized)

### UI/UX Design System

**Pixel Art Aesthetic**:

The game uses a retro-futuristic pixel art style combined with modern UI patterns:

**Visual Principles**:

- **No rounded corners**: All elements use `border-radius: 0 !important`
- **Sharp edges**: Blocky, geometric shapes inspired by 16-bit era
- **Depth via shadows**: Box shadows create layering (6px offset for cards, 4px for buttons)
- **Pixel-perfect alignment**: Grid-based spacing (8px increments)
- **Monospace typography**: `Inconsolata` font for all interactive elements

**Interactive Elements**:

**Buttons**:

```css
/* Pixel art button style */
button {
  border-radius: 0 !important;
  font-family: "Inconsolata", monospace !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  box-shadow: 4px 4px 0 rgba(0, 0, 0, 0.3) !important;
}

button:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
}

button:active {
  transform: translate(4px, 4px);
  box-shadow: none; /* "pressed" into surface */
}
```

**Cards**:

```css
/* Pixel art card style */
[class*="Card"] {
  border-radius: 0 !important;
  border: 2px solid var(--sds-clr-border-primary) !important;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.4) !important;
}
```

**Inputs**:

```css
/* Pixel art input style */
input,
textarea,
select {
  border-radius: 0 !important;
  border: 2px solid var(--sds-clr-border-primary) !important;
  font-family: "Inconsolata", monospace !important;
}

input:focus {
  outline: 2px solid var(--text-primary) !important;
  outline-offset: 2px !important;
}
```

**Animation Patterns**:

- **Sequencing Text**: Wave gradient animation for "Sequencing..." loading state
- **Battle Effects**: Glitch effects, screen shake, impact flashes
- **Creature Reveal**: Fade-in with particle burst on finalization
- **Item Pickup**: Sparkle effect + bounce animation

**Responsive Design**:

- **Minimum Width**: 1000px (enforced in CSS)
- **Target Resolution**: 1920x1080 (primary design target)
- **Mobile**: Not optimized (desktop-first game experience)

### Typography

**Font Stack**:

- **Display Font**: `Inter` (variable weight 100-900) - Headings, body text
- **Code Font**: `Inconsolata` (weight 500) - Buttons, inputs, technical data
- **Fallback**: `monospace`, `sans-serif`

**Type Scale**:

- **Heading 1**: 2.5rem (40px) - Page titles
- **Heading 2**: 2rem (32px) - Section headers
- **Heading 3**: 1.5rem (24px) - Card titles
- **Body**: 1rem (16px) - Standard text
- **Small**: 0.875rem (14px) - Captions, metadata

**Usage Guidelines**:

- **ALL CAPS** for buttons, CTAs, emphasis
- **Sentence case** for body text, descriptions
- **Letter spacing**: +1px for headings, +0.5px for buttons

### Iconography

**Icon Style**:

- **Line-based**: 2px stroke weight
- **Pixel-aligned**: Icons snap to 24x24px grid
- **Monochrome**: Single color, no gradients
- **Minimalist**: Simplified shapes, high recognition

**Required Icons**:

- Splice icon (DNA helix + syringe)
- Battle icon (crossed swords)
- Inventory icon (backpack/container)
- Settings icon (gear)
- Wallet icon (currency symbol)
- Creature icon (skull/monster silhouette)
- Cartridge icon (vial/capsule)

### Original Creature Artwork (Expanded)

**Current 6-Layer System**:

The creature rendering system uses layered PNG compositing:

1. **Feet Layer** (`public/assets/creatures/feet/`)
2. **Arms Layer** (`public/assets/creatures/arms/`)
3. **Torso Layer** (`public/assets/creatures/torsos/`)
4. **Head Layer** (`public/assets/creatures/heads/`)
5. **Face Layer** (`public/assets/creatures/faces/`)
6. **Eyes Layer** (`public/assets/creatures/eyes/`)

**Rendering Order** (bottom to top):

```
Eyes (top, animated)
↓
Face (expressions)
↓
Head (base structure)
↓
Torso (body)
↓
Arms (attachments)
↓
Feet (bottom, positioning)
```

**Asset Specifications**:

**Dimensions**:

- **Canvas Size**: 256x256px (native resolution)
- **Display Size**: 512x512px (2x upscale, nearest-neighbor filtering)
- **Export Size**: 1024x1024px (for NFT metadata, high-res)

**Naming Convention**:

- `{layer}-{gene_id}.png`
- Example: `head-3.png` (Golem head, Legendary)
- Ensures 1:1 mapping between gene ID and asset file

**Positioning & Offsets**:

```typescript
// src/components/CreatureDisplay.tsx
const layerOffsets = {
  feet: { x: 0, y: 20 }, // Bottom positioning
  arms: { x: 0, y: 10 }, // Mid positioning
  torso: { x: 0, y: 5 }, // Mid-high positioning
  head: { x: 0, y: -10 }, // Top positioning
  face: { x: 5, y: -8 }, // Slight right offset
  eyes: { x: 6, y: -12 }, // Animated, top layer
};
```

**Placeholder Art vs. Original Art**:

| Aspect             | Current (Placeholder)         | Target (Original)                     |
| ------------------ | ----------------------------- | ------------------------------------- |
| **Visual Style**   | Generic pixel sprites         | Unique designs per creature type      |
| **Rarity Effects** | None                          | Glows, auras, particles for Legendary |
| **Animation**      | Static images                 | Idle animations, battle frames        |
| **Color Palette**  | Inconsistent                  | Unified dark fantasy palette          |
| **Detail Level**   | Minimal                       | Hand-crafted details, textures        |
| **Variants**       | 15 IDs (5 per type × 3 types) | Same structure + bonus variants       |

**Production Roadmap**:

1. **Phase 1**: Concept art for 5 creature types (Golem, Dark Oracle, Necromancer, Skeleton Crusader, Skeleton Warrior)
2. **Phase 2**: Pixel art sprites for 15 gene IDs (3 variants per type)
3. **Phase 3**: Rarity VFX (glow layers, particle systems for Legendary)
4. **Phase 4**: Animation frames (idle, attack, hurt, death)
5. **Phase 5**: High-res exports for NFT metadata (1024x1024px)

**Visual Themes by Creature Type**:

- **Golem** (Legendary): Stone texture, glowing runes, massive build
- **Dark Oracle** (Rare): Ethereal robes, void energy, floating elements
- **Necromancer** (Normal): Tattered robes, bone staff, green necro-glow
- **Skeleton Crusader** (Normal): Heavy armor, sword/shield, disciplined
- **Skeleton Warrior** (Normal): Light armor, dual weapons, aggressive

**VFX Layers for Legendary Creatures**:

- **Glow Layer**: Outer aura (additive blending)
- **Particle Layer**: Floating embers, energy wisps (animated)
- **Distortion Layer**: Heat haze, void ripple (shader-based)

**Art Style References**:

- **Pixel Art**: Hyper Light Drifter, Dead Cells, Blasphemous
- **Dark Fantasy**: Diablo, Dark Souls, Darkest Dungeon
- **Sci-Fi Elements**: Cyberpunk 2077, Deus Ex, The Ascent

---

## Security Considerations

**Entropy Verification**:

- All cryptographic operations on-chain
- Subgroup membership checks prevent invalid curve attacks
- Hash-to-Curve performed by contract (no relayer influence)
- Pairing verification requires drand's private key

**Battle Fairness**:

- RNG seed derived from block hash + player addresses
- Turn order deterministic (speed stat)
- All damage calculations on-chain
- No front-running possible (transactions are atomic)

**Item Security**:

- Items are NFTs (ownership enforced by contract)
- Equipment changes emit events (auditable)
- Item effects validated on-chain (no client trust)

**Fusion Safety**:

- Source creatures burned atomically with new mint
- Cannot fuse creatures you don't own
- Generation counter prevents circular fusion

---

## Roadmap

### Phase 1: Core Loop (Complete ✅)

- ✅ Genome cartridge minting
- ✅ Drand entropy integration
- ✅ BLS12-381 verification
- ✅ Permissionless finalization
- ✅ Gene-based creature generation
- ✅ Client-side rendering

### Phase 2: Metadata & Assets (In Progress)

- 🔄 IPFS metadata pinning
- 🔄 Comprehensive NFT metadata JSON
- 🔄 Service worker for image generation
- ⏳ Asset optimization & variations

### Phase 3: Combat System (Planned)

- ⏳ PvP battle mechanics
- ⏳ Turn-based combat contract
- ⏳ Battle UI & animations
- ⏳ Leaderboards & rankings
- ⏳ ELO matchmaking

### Phase 4: Items & Abilities (Planned)

- ⏳ Item NFT system
- ⏳ Equipment slots & bonuses
- ⏳ Part-based abilities
- ⏳ Crafting system
- ⏳ Item marketplace

### Phase 5: Advanced Features (Planned)

- ⏳ Creature fusion
- ⏳ Lore animations
- ⏳ Achievement system
- ⏳ Tournaments
- ⏳ Guild/clan system

### Phase 6: Economy (Planned)

- ⏳ Game token launch
- ⏳ Staking rewards
- ⏳ Governance system
- ⏳ Premium features

---

## Conclusion

Gene Splicing v1.1 expands from a simple NFT minting game into a comprehensive combat strategy game with deep RPG mechanics. By combining verifiable randomness, strategic itemization, creature fusion, and rich storytelling, the game creates a compelling loop:

1. **Collect** creatures through splicing
2. **Battle** other players to earn rewards
3. **Equip** items to enhance creatures
4. **Fuse** creatures to create ultimate warriors
5. **Discover** lore through gameplay
6. **Compete** on leaderboards for glory

The modular design allows features to be rolled out incrementally while maintaining backward compatibility with v1.0 creatures.

**Next Steps**: Implement NFT metadata pinning to establish creature identities off-chain, then begin battle system development.

---

_Last Updated: 2025-11-05_
_Version: 1.1_
_Contract: Soroban (Stellar Testnet)_
