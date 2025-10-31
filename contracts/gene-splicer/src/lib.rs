#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, Symbol, Vec,
};

/// Genome Cartridge NFT - minted when user splices, before finalization
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenomeCartridge {
    pub id: u32,
    pub owner: Address,
    pub skin_id: u32,      // Random cosmetic skin selected via PRNG
    pub splice_round: u64, // Drand round for later entropy use
    pub created_at: u64,   // Ledger timestamp
}

/// Storage keys for the contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    XlmToken,              // Address of native XLM SAC token
    CartridgeSkinCount,    // Total number of skin variants available
    NextCartridgeId,       // Counter for minting new cartridges
    Cartridge(u32),        // Cartridge ID -> GenomeCartridge data
    UserCartridges(Address), // User -> Vec<u32> of cartridge IDs
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
    ) {
        admin.require_auth();

        // Store configuration
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::XlmToken, &xlm_token);
        env.storage()
            .instance()
            .set(&DataKey::CartridgeSkinCount, &cartridge_skin_count);
        env.storage().instance().set(&DataKey::NextCartridgeId, &1u32);
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
        xlm_client.transfer(&user, &admin, &fee_amount);

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
}

#[cfg(test)]
mod test;
