#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Symbol, Vec, Bytes, BytesN,
    crypto::bls12_381::{G1Affine, G2Affine},
};

/// Gene rarity levels (affects visual appearance and value)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GeneRarity {
    Normal,    // 60% chance (IDs 0-5)
    Rare,      // 30% chance (IDs 6-8)
    Legendary, // 10% chance (ID 9)
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
    pub id: u32,              // Same ID as the cartridge it came from
    pub owner: Address,
    pub skin_id: u32,         // Inherited from cartridge
    pub head_gene: Gene,      // Head gene (1 of 10)
    pub torso_gene: Gene,     // Torso gene (1 of 10)
    pub legs_gene: Gene,      // Legs gene (1 of 10)
    pub finalized_at: u64,    // Ledger timestamp of finalization
    pub entropy_round: u64,   // Drand round used for gene selection
}

/// Drand entropy data for a specific round
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EntropyData {
    pub round: u64,
    pub randomness: Bytes,    // 32-byte randomness from drand
    pub signature: Bytes,     // BLS12-381 signature verified on submission
    pub submitted_at: u64,    // Ledger timestamp
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
    Entropy(u64),            // Drand round -> EntropyData
    Creature(u32),           // Creature ID -> Creature data (same ID as cartridge)
    UserCreatures(Address),  // User -> Vec<u32> of creature IDs
    DevMode,                 // Boolean flag to bypass entropy verification in development
    DrandPublicKey,          // BLS12-381 G2 public key from drand quicknet (96 bytes compressed)
}

#[contract]
pub struct GeneSplicer;

#[contractimpl]
impl GeneSplicer {
    /// Initialize the contract
    pub fn initialize(
        env: Env,
        admin: Address,
        xlm_token: Address,
        cartridge_skin_count: u64,
        dev_mode: bool,
        drand_public_key: Bytes,
    ) {
        admin.require_auth();

        // Validate drand public key is 192 bytes (BLS12-381 G2 point, uncompressed affine coordinates)
        // Format: x_c0 (48 bytes) || x_c1 (48 bytes) || y_c0 (48 bytes) || y_c1 (48 bytes)
        if drand_public_key.len() != 192 {
            panic!("Drand public key must be 192 bytes (uncompressed G2 affine coordinates)");
        }

        // Store configuration
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::XlmToken, &xlm_token);
        env.storage()
            .instance()
            .set(&DataKey::CartridgeSkinCount, &cartridge_skin_count);
        env.storage().instance().set(&DataKey::NextCartridgeId, &1u32);
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

        // Estimate current drand round based on ledger timestamp
        // Drand round 1 started at Unix timestamp 1595431050
        // Drand emits a round every 30 seconds
        let ledger_time = env.ledger().timestamp();
        let drand_genesis = 1595431050u64;
        let drand_period = 30u64;
        let splice_round = if ledger_time > drand_genesis {
            ((ledger_time - drand_genesis) / drand_period) + 1
        } else {
            1
        };

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

        // Emit event using tuple (simplified approach)
        env.events().publish(
            (Symbol::new(&env, "cartridge_minted"), cartridge_id),
            (cartridge.owner.clone(), cartridge.skin_id),
        );

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

    /// Submit entropy for a drand round with CAP-0059 verification
    /// Verifies the BLS12-381 signature from drand quicknet (unless dev_mode is enabled)
    pub fn submit_entropy(
        env: Env,
        submitter: Address,
        round: u64,
        randomness: Bytes,
        signature: Bytes,
    ) {
        submitter.require_auth();

        // Check if entropy already exists for this round
        if env
            .storage()
            .persistent()
            .has(&DataKey::Entropy(round))
        {
            panic!("Entropy already submitted for this round");
        }

        // Validate randomness is 32 bytes (SHA-256 output)
        if randomness.len() != 32 {
            panic!("Randomness must be 32 bytes");
        }

        // Validate signature is 96 bytes (BLS12-381 G1 point, uncompressed affine coordinates)
        // Format: x (48 bytes) || y (48 bytes)
        if signature.len() != 96 {
            panic!("Signature must be 96 bytes (uncompressed G1 affine coordinates)");
        }

        // Check if dev_mode is enabled
        let dev_mode: bool = env
            .storage()
            .instance()
            .get(&DataKey::DevMode)
            .unwrap_or(false);

        // Verify signature using CAP-0059 BLS12-381 pairing check (unless in dev mode)
        if !dev_mode {
            Self::verify_drand_signature(&env, round, &signature);
        }

        let entropy = EntropyData {
            round,
            randomness,
            signature,
            submitted_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Entropy(round), &entropy);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "entropy_submitted"), round),
            submitter,
        );
    }

    /// Finalize a cartridge into a Creature NFT using drand entropy
    pub fn finalize_splice(env: Env, cartridge_id: u32) -> u32 {
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

        // Get entropy for the cartridge's splice round
        let entropy: EntropyData = env
            .storage()
            .persistent()
            .get(&DataKey::Entropy(cartridge.splice_round))
            .unwrap_or_else(|| panic!("Entropy not available for this round"));

        // Select genes using entropy
        let head_gene = Self::select_gene(&env, &entropy.randomness, 0);
        let torso_gene = Self::select_gene(&env, &entropy.randomness, 1);
        let legs_gene = Self::select_gene(&env, &entropy.randomness, 2);

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
        env.events().publish(
            (Symbol::new(&env, "creature_finalized"), cartridge_id),
            (
                creature.head_gene.id,
                creature.torso_gene.id,
                creature.legs_gene.id,
            ),
        );

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

        // Map to 0-9 gene ID with weighted distribution
        // 0-5: Normal (60%), 6-8: Rare (30%), 9: Legendary (10%)
        let gene_id = (random_value % 10) as u32;

        let rarity = if gene_id <= 5 {
            GeneRarity::Normal
        } else if gene_id <= 8 {
            GeneRarity::Rare
        } else {
            GeneRarity::Legendary
        };

        Gene { id: gene_id, rarity }
    }

    /// Get entropy data for a specific drand round
    pub fn get_entropy(env: Env, round: u64) -> Option<EntropyData> {
        env.storage().persistent().get(&DataKey::Entropy(round))
    }

    /// Get creature data by ID
    pub fn get_creature(env: Env, creature_id: u32) -> Option<Creature> {
        env.storage().persistent().get(&DataKey::Creature(creature_id))
    }

    /// Get all creature IDs owned by a user
    pub fn get_user_creatures(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserCreatures(user))
            .unwrap_or(Vec::new(&env))
    }

    /// Verify drand BLS12-381 signature using CAP-0059
    ///
    /// ARCHITECTURE: Relayer does parsing (non-security-critical), Contract does verification (security-critical)
    ///
    /// RELAYER RESPONSIBILITIES:
    /// - Fetch drand entropy from drand quicknet API
    /// - Decompress BLS12-381 points:
    ///   * G1 signature: 48 bytes compressed -> 96 bytes uncompressed (x || y)
    ///   * G2 pubkey: 96 bytes compressed -> 192 bytes uncompressed (x_c1 || x_c0 || y_c1 || y_c0)
    /// - Pass uncompressed affine coordinates to contract
    ///
    /// CONTRACT RESPONSIBILITIES (this function):
    /// 1. Construct G1Affine from signature bytes (96 bytes uncompressed)
    /// 2. Perform subgroup check on signature
    /// 3. Fetch previous round's signature to construct message
    /// 4. Build message: prev_sig || round_bytes (8 bytes big-endian)
    /// 5. Hash message to G1 using hash_to_g1() with DST "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
    /// 6. Perform subgroup check on hashed point
    /// 7. Construct G2Affine from drand public key bytes (192 bytes uncompressed)
    /// 8. Perform subgroup check on public key
    /// 9. Construct G2 generator
    /// 10. Verify pairing: e(signature, G2_gen) == e(H(msg), drand_pubkey)
    fn verify_drand_signature(env: &Env, round: u64, signature: &Bytes) {
        // Signature must be 96 bytes: x (48 bytes) || y (48 bytes)
        if signature.len() != 96 {
            panic!("Signature must be 96 bytes (uncompressed G1 affine)");
        }

        // Construct G1Affine from signature bytes
        // Convert Bytes to BytesN<96>
        let sig_bytes: BytesN<96> = signature.clone().try_into()
            .unwrap_or_else(|_| panic!("Signature must be exactly 96 bytes"));
        let sig_point = G1Affine::from_bytes(sig_bytes);

        // Subgroup check on signature
        if !env.crypto().bls12_381().g1_is_in_subgroup(&sig_point) {
            panic!("Signature not in G1 subgroup");
        }

        // Fetch previous round's signature to construct message
        let prev_signature: Bytes = if round > 1 {
            let prev_key = DataKey::Entropy(round - 1);
            let prev_entropy: EntropyData = env
                .storage()
                .persistent()
                .get(&prev_key)
                .expect("Previous round entropy not found - cannot verify chained signature");
            prev_entropy.signature
        } else {
            // For round 1, use empty prev signature (drand genesis)
            Bytes::new(env)
        };

        // Construct message: prev_sig || round_bytes (big-endian)
        let mut message = Bytes::new(env);
        message.append(&prev_signature);

        // Append round as 8 bytes, big-endian
        let round_bytes: [u8; 8] = round.to_be_bytes();
        for byte in round_bytes.iter() {
            message.push_back(*byte);
        }

        // Hash message to G1 using drand DST
        // DST: "BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
        let dst = Bytes::from_slice(
            env,
            b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_"
        );

        let hashed_point = env
            .crypto()
            .bls12_381()
            .hash_to_g1(&message, &dst);

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
        let pubkey_bytes: BytesN<192> = drand_pubkey_bytes.try_into()
            .unwrap_or_else(|_| panic!("Public key must be exactly 192 bytes"));
        let drand_pubkey = G2Affine::from_bytes(pubkey_bytes);

        // Subgroup check on public key
        if !env.crypto().bls12_381().g2_is_in_subgroup(&drand_pubkey) {
            panic!("Public key not in G2 subgroup");
        }

        // G2 generator (standard BLS12-381 G2 generator, uncompressed 192 bytes)
        // x_c1 || x_c0 || y_c1 || y_c0
        let g2_gen_bytes: BytesN<192> = BytesN::from_array(
            env,
            &[
                // x_c1 (48 bytes)
                0x13, 0xe0, 0x2b, 0x60, 0x52, 0x71, 0x9f, 0x60, 0x7d, 0xac, 0xd3, 0xa0,
                0x88, 0x27, 0x4f, 0x65, 0x59, 0x6b, 0xd0, 0xd0, 0x99, 0x20, 0xb6, 0x1a,
                0xb5, 0xda, 0x61, 0xbb, 0xdc, 0x7f, 0x5d, 0xfa, 0x80, 0xba, 0x1e, 0x0b,
                0x4a, 0x5d, 0x99, 0xd9, 0x36, 0x04, 0x74, 0xa4, 0x5d, 0x31, 0xf0, 0xde,
                // x_c0 (48 bytes)
                0x0b, 0x2b, 0xc5, 0xa9, 0x45, 0x48, 0xb0, 0x46, 0x14, 0x95, 0xd4, 0x10,
                0xa0, 0x93, 0xed, 0x4f, 0xd9, 0x3f, 0x92, 0xf2, 0xd8, 0x57, 0x13, 0x86,
                0xd9, 0x8e, 0xd6, 0x79, 0x44, 0xec, 0x09, 0x7f, 0x20, 0xe0, 0xcd, 0x33,
                0xce, 0x08, 0xe2, 0xd9, 0xe3, 0x3a, 0xd9, 0x0d, 0x2d, 0x82, 0xe0, 0x05,
                // y_c1 (48 bytes)
                0x06, 0x06, 0xc4, 0xa0, 0x28, 0x96, 0x07, 0xf6, 0xbe, 0xad, 0xfc, 0x04,
                0x35, 0xfe, 0x1d, 0xac, 0xca, 0x32, 0x1e, 0x1e, 0xa5, 0x81, 0x0b, 0xd7,
                0x15, 0x9d, 0x72, 0x8b, 0xe5, 0x6e, 0x3e, 0xbe, 0x8a, 0x9a, 0x20, 0x1c,
                0x39, 0x82, 0x8d, 0x42, 0xe7, 0xe7, 0xed, 0x69, 0x5e, 0xeb, 0xe4, 0xd4,
                // y_c0 (48 bytes)
                0x17, 0x0d, 0x51, 0x06, 0x36, 0xb5, 0x09, 0x9d, 0x7e, 0xf3, 0xb1, 0xa3,
                0x5a, 0x50, 0x47, 0xbb, 0xe9, 0xbe, 0x8a, 0x35, 0xad, 0xdc, 0xc9, 0x54,
                0x98, 0x6d, 0x7e, 0x3d, 0x4b, 0x70, 0xa9, 0x7d, 0x8c, 0xda, 0x69, 0x48,
                0x9b, 0x68, 0x6c, 0x9a, 0x30, 0x7c, 0x50, 0x89, 0xa8, 0x62, 0xd0, 0xa5,
            ]
        );

        let g2_gen = G2Affine::from_bytes(g2_gen_bytes);

        // Construct vectors for pairing check
        // Verify: e(sig_point, g2_gen) == e(hashed_point, drand_pubkey)
        // Using pairing equation: e(sig_point, g2_gen) * e(-hashed_point, drand_pubkey) == 1
        // But pairing_check handles the negation internally, so we just pass the points

        let mut g1_points = Vec::new(env);
        g1_points.push_back(sig_point);
        g1_points.push_back(hashed_point);

        let mut g2_points = Vec::new(env);
        g2_points.push_back(g2_gen);
        g2_points.push_back(drand_pubkey);

        // Perform pairing check
        let valid = env
            .crypto()
            .bls12_381()
            .pairing_check(g1_points, g2_points);

        if !valid {
            panic!("BLS12-381 pairing verification failed");
        }
    }
}

#[cfg(test)]
mod test;
