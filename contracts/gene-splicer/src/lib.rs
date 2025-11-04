#![no_std]

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype,
    crypto::bls12_381::{G1Affine, G2Affine},
    token, Address, Bytes, BytesN, Env, Symbol, Vec,
};

/// Gene rarity levels (affects visual appearance and value)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GeneRarity {
    Normal,    // 60% chance - Necromancer, Skeleton Crusader, Skeleton Warrior (IDs 6-14)
    Rare,      // 30% chance - Dark Oracle (IDs 0-2)
    Legendary, // 10% chance - Golem (IDs 3-5)
}

/// Individual gene with ID and rarity
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Gene {
    pub id: u32,
    pub rarity: GeneRarity,
}

/// Genome Cartridge NFT - minted when user splices, before finalization
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenomeCartridge {
    pub id: u32,
    pub owner: Address,
    pub skin_id: u32,      // Random cosmetic skin selected via PRNG
    pub splice_round: u64, // Drand round for later entropy use
    pub created_at: u64,   // Ledger timestamp
    pub finalized: bool,   // Whether cartridge has been transformed into a Creature
}

/// Creature NFT - final form after finalization with entropy
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Creature {
    pub id: u32, // Same ID as the cartridge it came from
    pub owner: Address,
    pub skin_id: u32,       // Inherited from cartridge
    pub head_gene: Gene,    // Head gene (1 of 10)
    pub torso_gene: Gene,   // Torso gene (1 of 10)
    pub legs_gene: Gene,    // Legs gene (1 of 10)
    pub finalized_at: u64,  // Ledger timestamp of finalization
    pub entropy_round: u64, // Drand round used for gene selection
}

/// Storage keys for the contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    XlmToken,                // Address of native XLM SAC token
    CartridgeSkinCount,      // Total number of skin variants available
    NextCartridgeId,         // Counter for minting new cartridges
    Cartridge(u32),          // Cartridge ID -> GenomeCartridge data
    UserCartridges(Address), // User -> Vec<u32> of cartridge IDs
    Creature(u32),           // Creature ID -> Creature data (same ID as cartridge)
    UserCreatures(Address),  // User -> Vec<u32> of creature IDs
    DevMode,                 // Boolean flag to bypass entropy verification in development
    DrandPublicKey,          // BLS12-381 G2 public key from drand quicknet (96 bytes compressed)
}

/// Event emitted when a cartridge is minted
#[contractevent]
pub struct CartridgeMinted {
    pub cartridge_id: u32,
    pub owner: Address,
    pub skin_id: u32,
}

/// Event emitted when a creature is finalized
#[contractevent]
pub struct CreatureFinalized {
    pub cartridge_id: u32,
    pub head_gene_id: u32,
    pub torso_gene_id: u32,
    pub legs_gene_id: u32,
}

#[contract]
pub struct GeneSplicer;

#[contractimpl]
impl GeneSplicer {
    /// Constructor - runs automatically during contract deployment
    /// CAP-0058: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0058.md
    /// Note: dev_mode should be false in production for full BLS12-381 verification
    pub fn __constructor(
        env: Env,
        admin: Address,
        xlm_token: Address,
        cartridge_skin_count: u64,
        dev_mode: bool,
        drand_public_key: Bytes,
    ) {
        // No require_auth needed - constructor only runs once at deployment time

        // Validate drand public key is 192 bytes (BLS12-381 G2 point, uncompressed affine coordinates)
        // Format: x_c1 || x_c0 || y_c1 || y_c0 (each component 48 bytes, CAP-0059)
        if drand_public_key.len() != 192 {
            panic!("Drand public key must be 192 bytes (uncompressed G2 affine coordinates)");
        }

        // Store configuration
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::XlmToken, &xlm_token);
        env.storage()
            .instance()
            .set(&DataKey::CartridgeSkinCount, &cartridge_skin_count);
        env.storage()
            .instance()
            .set(&DataKey::NextCartridgeId, &1u32);
        env.storage().instance().set(&DataKey::DevMode, &dev_mode);
        env.storage()
            .instance()
            .set(&DataKey::DrandPublicKey, &drand_public_key);
    }

    /// Mint a new Genome Cartridge NFT
    /// - Transfers 1 XLM fee from user to admin
    /// - Uses PRNG to select random cartridge skin
    /// - Mints cartridge NFT with assigned splice_round
    /// Returns the cartridge ID
    pub fn splice_genome(env: Env, user: Address) -> u32 {
        user.require_auth();

        // Get contract configuration
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        let xlm_token: Address = env.storage().instance().get(&DataKey::XlmToken).unwrap();
        let skin_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::CartridgeSkinCount)
            .unwrap();

        // Transfer 1 XLM (10_000_000 stroops) from user to admin
        let xlm_client = token::Client::new(&env, &xlm_token);
        let fee_amount: i128 = 10_000_000; // 1 XLM = 10^7 stroops

        // Verify user has sufficient balance before attempting transfer
        let user_balance = xlm_client.balance(&user);
        if user_balance < fee_amount {
            panic!("Insufficient XLM balance for minting fee");
        }

        // Get balances before transfer for verification
        let admin_balance_before = xlm_client.balance(&admin);

        // Execute transfer - will panic if it fails for any reason
        xlm_client.transfer(&user, &admin, &fee_amount);

        // Verify transfer succeeded by checking admin received the funds
        let admin_balance_after = xlm_client.balance(&admin);
        if admin_balance_after != admin_balance_before + fee_amount {
            panic!("Transfer verification failed");
        }

        // Generate random skin ID using PRNG (u64 for GenRange compatibility)
        let skin_id: u64 = env.prng().gen_range(0..skin_count);
        let skin_id = skin_id as u32;

        // Assign a future drand round to prevent frontrunning
        // Drand quicknet round 1 started at Unix timestamp 1692803367 (Aug 23, 2023)
        // Quicknet emits a round every 3 seconds
        // We assign current_round + 2 to ensure the round hasn't happened yet
        let ledger_time = env.ledger().timestamp();
        let drand_genesis = 1692803367u64;
        let drand_period = 3u64;
        let current_round = if ledger_time > drand_genesis {
            ((ledger_time - drand_genesis) / drand_period) + 1
        } else {
            1
        };
        let splice_round = current_round + 2; // Assign future round

        // Mint the cartridge
        let cartridge_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextCartridgeId)
            .unwrap();

        let cartridge = GenomeCartridge {
            id: cartridge_id,
            owner: user.clone(),
            skin_id,
            splice_round,
            created_at: ledger_time,
            finalized: false,
        };

        // Store cartridge data
        env.storage()
            .persistent()
            .set(&DataKey::Cartridge(cartridge_id), &cartridge);

        // Add to user's cartridge list
        let mut user_cartridges: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserCartridges(user.clone()))
            .unwrap_or(Vec::new(&env));
        user_cartridges.push_back(cartridge_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserCartridges(user), &user_cartridges);

        // Increment cartridge counter
        env.storage()
            .instance()
            .set(&DataKey::NextCartridgeId, &(cartridge_id + 1));

        // Emit event
        CartridgeMinted {
            cartridge_id,
            owner: cartridge.owner.clone(),
            skin_id: cartridge.skin_id,
        }
        .publish(&env);

        cartridge_id
    }

    /// Get cartridge data by ID
    pub fn get_cartridge(env: Env, cartridge_id: u32) -> Option<GenomeCartridge> {
        env.storage()
            .persistent()
            .get(&DataKey::Cartridge(cartridge_id))
    }

    /// Get all cartridge IDs owned by a user
    pub fn get_user_cartridges(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserCartridges(user))
            .unwrap_or(Vec::new(&env))
    }

    /// Get total number of cartridges minted
    pub fn get_total_cartridges(env: Env) -> u32 {
        let next_id: u32 = env
            .storage()
            .instance()
            .get(&DataKey::NextCartridgeId)
            .unwrap_or(1);
        next_id - 1
    }

    /// Get the admin address
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    /// Update admin (only callable by current admin)
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    /// Get number of available cartridge skins
    pub fn get_skin_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::CartridgeSkinCount)
            .unwrap()
    }

    /// Get stored drand public key (for debugging)
    pub fn get_drand_public_key(env: Env) -> Bytes {
        env.storage()
            .instance()
            .get(&DataKey::DrandPublicKey)
            .unwrap()
    }

    /// Force redeployment utility: comment/uncomment this function to change WASM hash
    /// This triggers scaffold to redeploy and regenerate TypeScript bindings with new contract ID
    // pub fn hello(env: Env) -> Symbol {
    //     Symbol::new(&env, "world")
    // }

    /// Finalize a cartridge into a Creature NFT using drand entropy
    /// User submits entropy (round, randomness, signature) which is verified inline
    pub fn finalize_splice(
        env: Env,
        cartridge_id: u32,
        round: u64,
        randomness: Bytes,
        signature: Bytes,
    ) -> u32 {
        // Get cartridge
        let mut cartridge: GenomeCartridge = env
            .storage()
            .persistent()
            .get(&DataKey::Cartridge(cartridge_id))
            .unwrap_or_else(|| panic!("Cartridge not found"));

        // Require auth from cartridge owner
        cartridge.owner.require_auth();

        // Check if already finalized
        if cartridge.finalized {
            panic!("Cartridge already finalized");
        }

        // Verify round matches cartridge's assigned round
        if round != cartridge.splice_round {
            panic!("Round mismatch");
        }

        // Validate randomness is 32 bytes (SHA-256 output)
        if randomness.len() != 32 {
            panic!("Randomness must be 32 bytes");
        }

        // Validate signature is 96 bytes (BLS12-381 G1 point, uncompressed affine coordinates)
        if signature.len() != 96 {
            panic!("Signature must be 96 bytes (uncompressed G1 affine coordinates)");
        }

        // Check if dev_mode is enabled
        let dev_mode: bool = env
            .storage()
            .instance()
            .get(&DataKey::DevMode)
            .unwrap_or(false);

        // Verify BLS signature (unless in dev mode)
        if !dev_mode {
            Self::verify_drand_signature(&env, round, &signature);
        }

        // Select genes using verified entropy
        let head_gene = Self::select_gene(&env, &randomness, 0);
        let torso_gene = Self::select_gene(&env, &randomness, 1);
        let legs_gene = Self::select_gene(&env, &randomness, 2);

        // Create creature
        let creature = Creature {
            id: cartridge_id,
            owner: cartridge.owner.clone(),
            skin_id: cartridge.skin_id,
            head_gene,
            torso_gene,
            legs_gene,
            finalized_at: env.ledger().timestamp(),
            entropy_round: cartridge.splice_round,
        };

        // Mark cartridge as finalized
        cartridge.finalized = true;
        env.storage()
            .persistent()
            .set(&DataKey::Cartridge(cartridge_id), &cartridge);

        // Store creature
        env.storage()
            .persistent()
            .set(&DataKey::Creature(cartridge_id), &creature);

        // Add to user's creature list
        let mut user_creatures: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserCreatures(cartridge.owner.clone()))
            .unwrap_or(Vec::new(&env));
        user_creatures.push_back(cartridge_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserCreatures(cartridge.owner), &user_creatures);

        // Emit event
        CreatureFinalized {
            cartridge_id,
            head_gene_id: creature.head_gene.id,
            torso_gene_id: creature.torso_gene.id,
            legs_gene_id: creature.legs_gene.id,
        }
        .publish(&env);

        cartridge_id
    }

    /// Helper: Select a gene using entropy bytes and gene slot (0=head, 1=torso, 2=legs)
    fn select_gene(_env: &Env, entropy: &Bytes, slot: u32) -> Gene {
        // Use different entropy bytes for each gene slot
        let offset = (slot * 10) as u32;

        // Extract 4 bytes for this gene and convert to u32
        let byte1 = entropy.get(offset % 32).unwrap_or(0) as u32;
        let byte2 = entropy.get((offset + 1) % 32).unwrap_or(0) as u32;
        let byte3 = entropy.get((offset + 2) % 32).unwrap_or(0) as u32;
        let byte4 = entropy.get((offset + 3) % 32).unwrap_or(0) as u32;

        let random_value = (byte1 << 24) | (byte2 << 16) | (byte3 << 8) | byte4;

        // Map to 0-14 gene ID with weighted distribution
        // Legendary (10%): Golem (IDs 3-5)
        // Rare (30%): Dark Oracle (IDs 0-2)
        // Common (60%): Necromancer, Skeleton Crusader, Skeleton Warrior (IDs 6-14)

        let roll = (random_value % 10) as u32; // 0-9 for distribution
        let (gene_id, rarity) = if roll == 0 {
            // 10% chance - Legendary (Golem: IDs 3-5)
            let golem_variant = (random_value >> 8) % 3; // Use different bits for variant selection
            (3 + golem_variant as u32, GeneRarity::Legendary)
        } else if roll <= 3 {
            // 30% chance - Rare (Dark Oracle: IDs 0-2)
            let oracle_variant = (random_value >> 8) % 3;
            (oracle_variant as u32, GeneRarity::Rare)
        } else {
            // 60% chance - Common (IDs 6-14, 9 variants)
            let common_variant = (random_value >> 8) % 9;
            (6 + common_variant as u32, GeneRarity::Normal)
        };

        Gene {
            id: gene_id,
            rarity,
        }
    }

    /// Get creature data by ID
    pub fn get_creature(env: Env, creature_id: u32) -> Option<Creature> {
        env.storage()
            .persistent()
            .get(&DataKey::Creature(creature_id))
    }

    /// Get all creature IDs owned by a user
    pub fn get_user_creatures(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserCreatures(user))
            .unwrap_or(Vec::new(&env))
    }

    /// Get current dev mode status
    pub fn get_dev_mode(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::DevMode)
            .unwrap_or(false)
    }

    // ========== BLS12-381 TESTING ==========

    /// Test: Complete BLS12-381 drand signature verification with all arguments provided
    /// This function accepts all parameters and performs the full verification flow
    /// without relying on any stored state.
    ///
    /// Arguments:
    /// - round: Drand round number (u64)
    /// - signature: Uncompressed G1 point (96 bytes: x || y)
    /// - drand_public_key: Uncompressed G2 point (192 bytes: x_c1 || x_c0 || y_c1 || y_c0)
    ///
    /// Returns true if verification succeeds, false otherwise
    pub fn test_full_verification(
        env: Env,
        round: u64,
        signature: Bytes,
        drand_public_key: Bytes,
    ) -> bool {
        // Step 1: Negate signature BEFORE deserializing (to avoid needing to negate G1Affine)
        // Signature verification: e(sig, G2_gen) == e(H(msg), pubkey)
        // Rearranges to: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
        if signature.len() != 96 {
            return false;
        }

        // Negate the signature by negating the y-coordinate
        let negated_sig = crate::negate_g1_bytes(&env, &signature);

        let sig_bytes: BytesN<96> = match negated_sig.try_into() {
            Ok(b) => b,
            Err(_) => return false,
        };
        let neg_sig_point = G1Affine::from_bytes(sig_bytes);

        // Step 2: Check negated signature in G1 subgroup
        if !env.crypto().bls12_381().g1_is_in_subgroup(&neg_sig_point) {
            return false;
        }

        // Step 3: Construct message (SHA-256 of round number)
        let round_bytes: [u8; 8] = round.to_be_bytes();
        let mut round_bytes_soroban = Bytes::new(&env);
        for byte in round_bytes.iter() {
            round_bytes_soroban.push_back(*byte);
        }

        // SHA256 hash the round number
        let message_hash = env.crypto().sha256(&round_bytes_soroban);

        // Convert BytesN<32> to Bytes for hash_to_g1
        let message_bytes_n = message_hash.to_bytes();
        let mut message = Bytes::new(&env);
        for i in 0..32 {
            message.push_back(message_bytes_n.get(i).unwrap());
        }

        // Step 4: Hash message to G1 using drand DST
        let dst = Bytes::from_slice(&env, b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_");
        let hashed_point = env.crypto().bls12_381().hash_to_g1(&message, &dst);

        // Step 5: Check hashed point in G1 subgroup
        if !env.crypto().bls12_381().g1_is_in_subgroup(&hashed_point) {
            return false;
        }

        // Step 6: Deserialize drand public key (G2 point, 192 bytes uncompressed)
        if drand_public_key.len() != 192 {
            return false;
        }
        let pubkey_bytes: BytesN<192> = match drand_public_key.try_into() {
            Ok(b) => b,
            Err(_) => return false,
        };
        let drand_pubkey = G2Affine::from_bytes(pubkey_bytes);

        // Step 7: Check public key in G2 subgroup
        if !env.crypto().bls12_381().g2_is_in_subgroup(&drand_pubkey) {
            return false;
        }

        // Step 8: Get G2 generator
        let g2_gen_bytes: BytesN<192> = BytesN::from_array(
            &env,
            &[
                // x_c1 (48 bytes)
                0x13, 0xe0, 0x2b, 0x60, 0x52, 0x71, 0x9f, 0x60, 0x7d, 0xac, 0xd3, 0xa0, 0x88, 0x27,
                0x4f, 0x65, 0x59, 0x6b, 0xd0, 0xd0, 0x99, 0x20, 0xb6, 0x1a, 0xb5, 0xda, 0x61, 0xbb,
                0xdc, 0x7f, 0x50, 0x49, 0x33, 0x4c, 0xf1, 0x12, 0x13, 0x94, 0x5d, 0x57, 0xe5, 0xac,
                0x7d, 0x05, 0x5d, 0x04, 0x2b, 0x7e, // x_c0 (48 bytes)
                0x02, 0x4a, 0xa2, 0xb2, 0xf0, 0x8f, 0x0a, 0x91, 0x26, 0x08, 0x05, 0x27, 0x2d, 0xc5,
                0x10, 0x51, 0xc6, 0xe4, 0x7a, 0xd4, 0xfa, 0x40, 0x3b, 0x02, 0xb4, 0x51, 0x0b, 0x64,
                0x7a, 0xe3, 0xd1, 0x77, 0x0b, 0xac, 0x03, 0x26, 0xa8, 0x05, 0xbb, 0xef, 0xd4, 0x80,
                0x56, 0xc8, 0xc1, 0x21, 0xbd, 0xb8, // y_c1 (48 bytes)
                0x06, 0x06, 0xc4, 0xa0, 0x2e, 0xa7, 0x34, 0xcc, 0x32, 0xac, 0xd2, 0xb0, 0x2b, 0xc2,
                0x8b, 0x99, 0xcb, 0x3e, 0x28, 0x7e, 0x85, 0xa7, 0x63, 0xaf, 0x26, 0x74, 0x92, 0xab,
                0x57, 0x2e, 0x99, 0xab, 0x3f, 0x37, 0x0d, 0x27, 0x5c, 0xec, 0x1d, 0xa1, 0xaa, 0xa9,
                0x07, 0x5f, 0xf0, 0x5f, 0x79, 0xbe, // y_c0 (48 bytes)
                0x0c, 0xe5, 0xd5, 0x27, 0x72, 0x7d, 0x6e, 0x11, 0x8c, 0xc9, 0xcd, 0xc6, 0xda, 0x2e,
                0x35, 0x1a, 0xad, 0xfd, 0x9b, 0xaa, 0x8c, 0xbd, 0xd3, 0xa7, 0x6d, 0x42, 0x9a, 0x69,
                0x51, 0x60, 0xd1, 0x2c, 0x92, 0x3a, 0xc9, 0xcc, 0x3b, 0xac, 0xa2, 0x89, 0xe1, 0x93,
                0x54, 0x86, 0x08, 0xb8, 0x28, 0x01,
            ],
        );
        let g2_gen = G2Affine::from_bytes(g2_gen_bytes);

        // Step 9: Pairing verification
        // Verify: e(signature, G2_gen) == e(H(msg), pubkey)
        // Using pairing_check: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
        // We negated the signature before deserializing it

        let mut g1_points = Vec::new(&env);
        g1_points.push_back(neg_sig_point); // -signature (negated earlier)
        g1_points.push_back(hashed_point); // H(msg)

        let mut g2_points = Vec::new(&env);
        g2_points.push_back(g2_gen); // G2 generator
        g2_points.push_back(drand_pubkey); // drand public key

        // Perform pairing check: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
        env.crypto().bls12_381().pairing_check(g1_points, g2_points)
    }

    // ========== END BLS12-381 DEBUG HELPERS ==========
}

/// Negate a G1 point by negating its y-coordinate
/// Input: Bytes containing uncompressed G1 point (96 bytes: x || y)
/// Output: Bytes containing negated point (96 bytes: x || -y) where -y = p - y
/// p is the BLS12-381 base field modulus
fn negate_g1_bytes(env: &Env, point_bytes: &Bytes) -> Bytes {
    // Extract x-coordinate (bytes 0-47)
    let mut x_bytes = [0u8; 48];
    for i in 0..48_u32 {
        x_bytes[i as usize] = point_bytes.get(i).unwrap();
    }

    // Extract y-coordinate (bytes 48-95)
    let mut y_bytes = [0u8; 48];
    for i in 0..48_u32 {
        y_bytes[i as usize] = point_bytes.get(48 + i).unwrap();
    }

    // BLS12-381 base field modulus p (48 bytes, big-endian)
    let p: [u8; 48] = [
        0x1a, 0x01, 0x11, 0xea, 0x39, 0x7f, 0xe6, 0x9a, 0x4b, 0x1b, 0xa7, 0xb6, 0x43, 0x4b, 0xac,
        0xd7, 0x64, 0x77, 0x4b, 0x84, 0xf3, 0x85, 0x12, 0xbf, 0x67, 0x30, 0xd2, 0xa0, 0xf6, 0xb0,
        0xf6, 0x24, 0x1e, 0xab, 0xff, 0xfe, 0xb1, 0x53, 0xff, 0xff, 0xb9, 0xfe, 0xff, 0xff, 0xff,
        0xff, 0xaa, 0xab,
    ];

    // Compute -y = p - y (big-endian subtraction)
    let mut neg_y = [0u8; 48];
    let mut borrow: u16 = 0;

    for i in (0..48).rev() {
        let p_byte = p[i] as u16;
        let y_byte = y_bytes[i] as u16;
        let diff = p_byte.wrapping_sub(y_byte).wrapping_sub(borrow);
        neg_y[i] = (diff & 0xFF) as u8;
        borrow = if diff > 0xFF { 1 } else { 0 };
    }

    // Construct negated point bytes: x || (-y)
    let mut negated = Bytes::new(env);

    // Copy x-coordinate
    for i in 0..48 {
        negated.push_back(x_bytes[i]);
    }

    // Copy negated y-coordinate
    for i in 0..48 {
        negated.push_back(neg_y[i]);
    }

    negated
}

impl GeneSplicer {
    /// Verify drand quicknet (unchained) BLS12-381 signature using CAP-0059
    ///
    /// QUICKNET UNCHAINED MODE:
    /// - No chaining: each round is independently verifiable
    /// - Message: SHA-256(round) (8-byte big-endian round number)
    /// - Signature scheme: BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_
    /// - Public keys on G2 (192 bytes uncompressed), signatures on G1 (96 bytes uncompressed)
    ///
    /// USER RESPONSIBILITIES:
    /// - Fetch drand entropy from drand quicknet API v2
    /// - Decompress BLS12-381 points:
    ///   * G1 signature: 48 bytes compressed -> 96 bytes uncompressed (x || y)
    ///   * G2 pubkey: 96 bytes compressed -> 192 bytes uncompressed (x_c1 || x_c0 || y_c1 || y_c0)
    /// - Pass uncompressed affine coordinates to finalize_splice
    ///
    /// CONTRACT RESPONSIBILITIES (this function):
    /// 1. Construct G1Affine from signature bytes (96 bytes uncompressed)
    /// 2. Perform subgroup check on signature
    /// 3. Build message: SHA256(round_bytes) where round_bytes is 8 bytes big-endian
    /// 4. Hash message to G1 using hash_to_g1() with DST "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
    /// 5. Perform subgroup check on hashed point
    /// 6. Construct G2Affine from drand public key bytes (192 bytes uncompressed)
    /// 7. Perform subgroup check on public key
    /// 8. Construct G2 generator
    /// 9. Verify pairing: e(signature, G2_gen) == e(H(msg), drand_pubkey)
    pub fn verify_drand_signature(env: &Env, round: u64, signature: &Bytes) {
        // Signature must be 96 bytes: x (48 bytes) || y (48 bytes)
        if signature.len() != 96 {
            panic!("Signature must be 96 bytes (uncompressed G1 affine)");
        }

        // Negate signature BEFORE deserializing to avoid needing to negate G1Affine
        // Verification: e(sig, G2_gen) == e(H(msg), pubkey)
        // Rearranges to: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
        let negated_sig = crate::negate_g1_bytes(env, signature);

        // Construct G1Affine from negated signature bytes
        let sig_bytes: BytesN<96> = negated_sig
            .try_into()
            .unwrap_or_else(|_| panic!("Signature must be exactly 96 bytes"));
        let neg_sig_point = G1Affine::from_bytes(sig_bytes);

        // Subgroup check on negated signature
        if !env.crypto().bls12_381().g1_is_in_subgroup(&neg_sig_point) {
            panic!("Signature not in G1 subgroup");
        }

        // Construct message for unchained quicknet: SHA256(round_number)
        // Per official drand implementation: sha256(abi.encodePacked(roundNumber))
        let round_bytes: [u8; 8] = round.to_be_bytes();
        let mut round_bytes_soroban = Bytes::new(env);
        for byte in round_bytes.iter() {
            round_bytes_soroban.push_back(*byte);
        }

        // SHA256 hash the round number to get the message (32 bytes)
        let message_hash = env.crypto().sha256(&round_bytes_soroban);

        // Convert BytesN<32> to Bytes for hash_to_g1
        let message_bytes_n = message_hash.to_bytes();
        let mut message = Bytes::new(env);
        for i in 0..32 {
            message.push_back(message_bytes_n.get(i).unwrap());
        }

        // Hash message to G1 using drand quicknet DST
        // DST: "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
        // Note: Uses G1 because quicknet uses G1-G2 swap (signatures on G1, public keys on G2)
        let dst = Bytes::from_slice(env, b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_");

        let hashed_point = env.crypto().bls12_381().hash_to_g1(&message, &dst);

        // Subgroup check on hashed point (should always pass for hash_to_g1, but verify)
        if !env.crypto().bls12_381().g1_is_in_subgroup(&hashed_point) {
            panic!("Hashed point not in G1 subgroup");
        }

        // Fetch drand public key (192 bytes uncompressed G2 affine)
        let drand_pubkey_bytes: Bytes = env
            .storage()
            .instance()
            .get(&DataKey::DrandPublicKey)
            .expect("Drand public key not configured");

        if drand_pubkey_bytes.len() != 192 {
            panic!("Drand public key must be 192 bytes (uncompressed G2 affine)");
        }

        // Construct G2Affine from public key bytes
        // Convert Bytes to BytesN<192>
        let pubkey_bytes: BytesN<192> = drand_pubkey_bytes
            .try_into()
            .unwrap_or_else(|_| panic!("Public key must be exactly 192 bytes"));
        let drand_pubkey = G2Affine::from_bytes(pubkey_bytes.clone());

        // Test: Verify byte order by round-tripping
        let re = drand_pubkey.to_bytes();
        if re.to_array() != pubkey_bytes.to_array() {
            panic!("G2 PK byte order mismatch");
        }

        // Subgroup check on public key
        if !env.crypto().bls12_381().g2_is_in_subgroup(&drand_pubkey) {
            panic!("Public key not in G2 subgroup");
        }

        // G2 generator (standard BLS12-381 G2 generator, uncompressed 192 bytes)
        // Format: x_c1 || x_c0 || y_c1 || y_c0 (CAP-0059 byte order)
        // Reference: IETF draft-irtf-cfrg-pairing-friendly-curves
        let g2_gen_bytes: BytesN<192> = BytesN::from_array(
            env,
            &[
                // x_c1 (48 bytes)
                0x13, 0xe0, 0x2b, 0x60, 0x52, 0x71, 0x9f, 0x60, 0x7d, 0xac, 0xd3, 0xa0, 0x88, 0x27,
                0x4f, 0x65, 0x59, 0x6b, 0xd0, 0xd0, 0x99, 0x20, 0xb6, 0x1a, 0xb5, 0xda, 0x61, 0xbb,
                0xdc, 0x7f, 0x50, 0x49, 0x33, 0x4c, 0xf1, 0x12, 0x13, 0x94, 0x5d, 0x57, 0xe5, 0xac,
                0x7d, 0x05, 0x5d, 0x04, 0x2b, 0x7e, // x_c0 (48 bytes)
                0x02, 0x4a, 0xa2, 0xb2, 0xf0, 0x8f, 0x0a, 0x91, 0x26, 0x08, 0x05, 0x27, 0x2d, 0xc5,
                0x10, 0x51, 0xc6, 0xe4, 0x7a, 0xd4, 0xfa, 0x40, 0x3b, 0x02, 0xb4, 0x51, 0x0b, 0x64,
                0x7a, 0xe3, 0xd1, 0x77, 0x0b, 0xac, 0x03, 0x26, 0xa8, 0x05, 0xbb, 0xef, 0xd4, 0x80,
                0x56, 0xc8, 0xc1, 0x21, 0xbd, 0xb8, // y_c1 (48 bytes)
                0x06, 0x06, 0xc4, 0xa0, 0x2e, 0xa7, 0x34, 0xcc, 0x32, 0xac, 0xd2, 0xb0, 0x2b, 0xc2,
                0x8b, 0x99, 0xcb, 0x3e, 0x28, 0x7e, 0x85, 0xa7, 0x63, 0xaf, 0x26, 0x74, 0x92, 0xab,
                0x57, 0x2e, 0x99, 0xab, 0x3f, 0x37, 0x0d, 0x27, 0x5c, 0xec, 0x1d, 0xa1, 0xaa, 0xa9,
                0x07, 0x5f, 0xf0, 0x5f, 0x79, 0xbe, // y_c0 (48 bytes)
                0x0c, 0xe5, 0xd5, 0x27, 0x72, 0x7d, 0x6e, 0x11, 0x8c, 0xc9, 0xcd, 0xc6, 0xda, 0x2e,
                0x35, 0x1a, 0xad, 0xfd, 0x9b, 0xaa, 0x8c, 0xbd, 0xd3, 0xa7, 0x6d, 0x42, 0x9a, 0x69,
                0x51, 0x60, 0xd1, 0x2c, 0x92, 0x3a, 0xc9, 0xcc, 0x3b, 0xac, 0xa2, 0x89, 0xe1, 0x93,
                0x54, 0x86, 0x08, 0xb8, 0x28, 0x01,
            ],
        );

        let g2_gen = G2Affine::from_bytes(g2_gen_bytes);

        // Construct vectors for pairing check
        // Verify: e(signature, G2_gen) == e(H(msg), pubkey)
        // Using pairing_check: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
        let mut g1_points = Vec::new(env);
        g1_points.push_back(neg_sig_point); // -signature (negated earlier)
        g1_points.push_back(hashed_point); // H(msg)

        let mut g2_points = Vec::new(env);
        g2_points.push_back(g2_gen); // G2 generator
        g2_points.push_back(drand_pubkey); // drand public key

        // Perform pairing check: e(-sig, G2_gen) * e(H(msg), pubkey) == 1
        let valid = env.crypto().bls12_381().pairing_check(g1_points, g2_points);

        if !valid {
            panic!("BLS12-381 pairing verification failed");
        }
    }
}

#[cfg(test)]
mod test;
