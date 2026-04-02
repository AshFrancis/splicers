#![cfg(test)]

use crate::{GeneSplicer, GeneSplicerClient};
use soroban_sdk::{testutils::Address as _, token, Address, Bytes, Env};

fn create_xlm_token<'a>(env: &Env, admin: &Address) -> token::StellarAssetClient<'a> {
    let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
    token::StellarAssetClient::new(env, &asset_contract.address())
}

fn create_mock_drand_pubkey(env: &Env) -> Bytes {
    // Mock 192-byte drand public key for testing (dev_mode bypasses verification)
    Bytes::from_array(env, &[0x00; 192])
}

/// Helper: create mock entropy data for finalize_splice in dev_mode
/// In dev_mode, BLS verification and randomness matching are skipped,
/// but byte length and compression consistency validations still run.
fn create_mock_entropy(env: &Env) -> (Bytes, Bytes, Bytes) {
    let randomness = Bytes::from_array(env, &[0x42; 32]); // 32 bytes

    // Compressed G1: 48 bytes — byte 0 has flag bits in top 3 bits (0x80 = compressed flag)
    // x-coordinate bytes (after masking flags): 0x0a followed by 0xaa * 47
    let mut compressed = [0xaa_u8; 48];
    compressed[0] = 0x80 | 0x0a; // Compression flag + x-coord first byte = 0x8a

    // Uncompressed G1: 96 bytes — first 48 = x-coordinate, last 48 = y-coordinate
    // x-coordinate must match compressed (after stripping flags)
    let mut uncompressed = [0xbb_u8; 96];
    uncompressed[0] = 0x0a; // Same x-coord byte 0 as compressed (without flags)
    for i in 1..48 {
        uncompressed[i] = 0xaa; // Same x-coord as compressed
    }

    let sig_compressed = Bytes::from_array(env, &compressed);
    let sig_uncompressed = Bytes::from_array(env, &uncompressed);
    (randomness, sig_compressed, sig_uncompressed)
}

/// Helper: register contract with constructor args (replaces old initialize pattern)
fn setup_contract<'a>(
    env: &Env,
    admin: &Address,
    xlm_token_address: &Address,
    dev_mode: bool,
) -> GeneSplicerClient<'a> {
    let mock_pubkey = create_mock_drand_pubkey(env);
    let contract_id = env.register(
        GeneSplicer,
        (admin, xlm_token_address, 10u64, dev_mode, mock_pubkey),
    );
    GeneSplicerClient::new(env, &contract_id)
}

// ===== Basic minting tests =====

#[test]
fn test_splice_genome() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000); // 10 XLM

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Splice genome
    let cartridge_id = client.splice_genome(&user);
    assert_eq!(cartridge_id, 1);

    // Verify cartridge was created
    let cartridge = client.get_cartridge(&1).unwrap();
    assert_eq!(cartridge.id, 1);
    assert_eq!(cartridge.owner, user);
    assert!(cartridge.skin_id < 10);
    assert!(!cartridge.finalized);

    // Verify user owns the cartridge
    let user_cartridges = client.get_user_cartridges(&user);
    assert_eq!(user_cartridges.len(), 1);
    assert_eq!(user_cartridges.get(0).unwrap(), 1);

    // Verify total count
    assert_eq!(client.get_total_cartridges(), 1);

    // Verify admin received fee (1 XLM = 10_000_000 stroops)
    assert_eq!(xlm_token.balance(&admin), 10_000_000);
    assert_eq!(xlm_token.balance(&user), 90_000_000);
}

#[test]
fn test_multiple_splices() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user1, &100_000_000);
    xlm_token.mint(&user2, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Multiple users can mint
    let id1 = client.splice_genome(&user1);
    let id2 = client.splice_genome(&user2);
    let id3 = client.splice_genome(&user1);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);

    // User1 has 2 cartridges
    assert_eq!(client.get_user_cartridges(&user1).len(), 2);

    // User2 has 1 cartridge
    assert_eq!(client.get_user_cartridges(&user2).len(), 1);

    // Total is 3
    assert_eq!(client.get_total_cartridges(), 3);
}

#[test]
#[should_panic(expected = "Insufficient XLM balance for minting fee")]
fn test_splice_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    // Don't fund the user — they have 0 XLM

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Should panic because user has no XLM
    client.splice_genome(&user);
}

// ===== Admin tests =====

#[test]
fn test_admin_functions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Verify admin
    assert_eq!(client.admin(), admin);

    // Update admin
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
fn test_config_getters() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    assert_eq!(client.get_skin_count(), 10);
    assert!(client.get_dev_mode());
    assert_eq!(client.get_drand_public_key().len(), 192);
}

// ===== Finalization tests =====

#[test]
fn test_finalize_splice() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Mint a cartridge
    let cartridge_id = client.splice_genome(&user);
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();
    let splice_round = cartridge.splice_round;

    // Create mock entropy (dev_mode skips BLS and randomness verification)
    let (randomness, sig_compressed, sig_uncompressed) = create_mock_entropy(&env);

    // Finalize
    let creature_id = client.finalize_splice(
        &cartridge_id,
        &splice_round,
        &randomness,
        &sig_compressed,
        &sig_uncompressed,
    );
    assert_eq!(creature_id, cartridge_id);

    // Verify cartridge is now finalized
    let cartridge_after = client.get_cartridge(&cartridge_id).unwrap();
    assert!(cartridge_after.finalized);

    // Verify creature was created
    let creature = client.get_creature(&creature_id).unwrap();
    assert_eq!(creature.id, cartridge_id);
    assert_eq!(creature.owner, user);
    assert_eq!(creature.skin_id, cartridge.skin_id);
    assert_eq!(creature.entropy_round, splice_round);

    // Verify genes were assigned (IDs should be in valid range 0-14)
    assert!(creature.head_gene.id <= 14);
    assert!(creature.body_gene.id <= 14);
    assert!(creature.legs_gene.id <= 14);

    // Verify user owns the creature
    let user_creatures = client.get_user_creatures(&user);
    assert_eq!(user_creatures.len(), 1);
    assert_eq!(user_creatures.get(0).unwrap(), creature_id);
}

#[test]
#[should_panic(expected = "Cartridge already finalized")]
fn test_double_finalization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Mint and finalize
    let cartridge_id = client.splice_genome(&user);
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();
    let (randomness, sig_compressed, sig_uncompressed) = create_mock_entropy(&env);

    client.finalize_splice(
        &cartridge_id,
        &cartridge.splice_round,
        &randomness,
        &sig_compressed,
        &sig_uncompressed,
    );

    // Try to finalize again — should panic
    let (randomness2, sig_compressed2, sig_uncompressed2) = create_mock_entropy(&env);
    client.finalize_splice(
        &cartridge_id,
        &cartridge.splice_round,
        &randomness2,
        &sig_compressed2,
        &sig_uncompressed2,
    );
}

#[test]
#[should_panic(expected = "Round mismatch")]
fn test_finalize_wrong_round() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    let cartridge_id = client.splice_genome(&user);
    let (randomness, sig_compressed, sig_uncompressed) = create_mock_entropy(&env);

    // Use wrong round number — should panic
    client.finalize_splice(&cartridge_id, &99999u64, &randomness, &sig_compressed, &sig_uncompressed);
}

#[test]
#[should_panic(expected = "Cartridge not found")]
fn test_finalize_nonexistent_cartridge() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    let (randomness, sig_compressed, sig_uncompressed) = create_mock_entropy(&env);

    // Cartridge 999 doesn't exist — should panic
    client.finalize_splice(&999u32, &1u64, &randomness, &sig_compressed, &sig_uncompressed);
}

// ===== Input validation tests =====

#[test]
#[should_panic(expected = "Randomness must be 32 bytes")]
fn test_finalize_wrong_randomness_length() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    let cartridge_id = client.splice_genome(&user);
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();

    // Wrong randomness length (16 bytes instead of 32)
    let bad_randomness = Bytes::from_array(&env, &[0x42; 16]);
    let sig_compressed = Bytes::from_array(&env, &[0xaa; 48]);
    let sig_uncompressed = Bytes::from_array(&env, &[0xbb; 96]);

    client.finalize_splice(
        &cartridge_id,
        &cartridge.splice_round,
        &bad_randomness,
        &sig_compressed,
        &sig_uncompressed,
    );
}

#[test]
#[should_panic(expected = "Compressed signature must be 48 bytes")]
fn test_finalize_wrong_compressed_sig_length() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    let cartridge_id = client.splice_genome(&user);
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();

    let randomness = Bytes::from_array(&env, &[0x42; 32]);
    let bad_sig_compressed = Bytes::from_array(&env, &[0xaa; 32]); // Wrong: 32 instead of 48
    let sig_uncompressed = Bytes::from_array(&env, &[0xbb; 96]);

    client.finalize_splice(
        &cartridge_id,
        &cartridge.splice_round,
        &randomness,
        &bad_sig_compressed,
        &sig_uncompressed,
    );
}

#[test]
#[should_panic(expected = "Uncompressed signature must be 96 bytes")]
fn test_finalize_wrong_uncompressed_sig_length() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    let cartridge_id = client.splice_genome(&user);
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();

    let randomness = Bytes::from_array(&env, &[0x42; 32]);
    let sig_compressed = Bytes::from_array(&env, &[0xaa; 48]);
    let bad_sig_uncompressed = Bytes::from_array(&env, &[0xbb; 48]); // Wrong: 48 instead of 96

    client.finalize_splice(
        &cartridge_id,
        &cartridge.splice_round,
        &randomness,
        &sig_compressed,
        &bad_sig_uncompressed,
    );
}

// ===== TTL extension test =====

#[test]
fn test_extend_ttl() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // extend_ttl is permissionless — should not panic
    client.extend_ttl();
}

// ===== Constructor validation =====

#[test]
#[should_panic(expected = "Drand public key must be 192 bytes")]
fn test_constructor_rejects_wrong_pubkey_length() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    // 96 bytes instead of 192 — should panic during construction
    let bad_pubkey = Bytes::from_array(&env, &[0x00; 96]);
    env.register(
        GeneSplicer,
        (&admin, &xlm_token.address, 10u64, true, bad_pubkey),
    );
}

// ===== Batch query tests =====

#[test]
fn test_get_cartridges_batch() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Mint 3 cartridges
    let id1 = client.splice_genome(&user);
    let id2 = client.splice_genome(&user);
    let id3 = client.splice_genome(&user);

    // Batch fetch all 3
    let mut ids = soroban_sdk::Vec::new(&env);
    ids.push_back(id1);
    ids.push_back(id2);
    ids.push_back(id3);

    let results = client.get_cartridges_batch(&ids);
    assert_eq!(results.len(), 3);
    assert_eq!(results.get(0).unwrap().unwrap().id, 1);
    assert_eq!(results.get(1).unwrap().unwrap().id, 2);
    assert_eq!(results.get(2).unwrap().unwrap().id, 3);

    // Batch fetch with nonexistent ID
    let mut ids_with_missing = soroban_sdk::Vec::new(&env);
    ids_with_missing.push_back(id1);
    ids_with_missing.push_back(999u32);

    let results2 = client.get_cartridges_batch(&ids_with_missing);
    assert_eq!(results2.len(), 2);
    assert!(results2.get(0).unwrap().is_some());
    assert!(results2.get(1).unwrap().is_none());
}

#[test]
fn test_get_creatures_batch() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Mint and finalize 2 cartridges
    let id1 = client.splice_genome(&user);
    let id2 = client.splice_genome(&user);

    let c1 = client.get_cartridge(&id1).unwrap();
    let c2 = client.get_cartridge(&id2).unwrap();
    let (r, sc, su) = create_mock_entropy(&env);
    let (r2, sc2, su2) = create_mock_entropy(&env);

    client.finalize_splice(&id1, &c1.splice_round, &r, &sc, &su);
    client.finalize_splice(&id2, &c2.splice_round, &r2, &sc2, &su2);

    // Batch fetch
    let mut ids = soroban_sdk::Vec::new(&env);
    ids.push_back(id1);
    ids.push_back(id2);

    let results = client.get_creatures_batch(&ids);
    assert_eq!(results.len(), 2);
    assert_eq!(results.get(0).unwrap().unwrap().id, id1);
    assert_eq!(results.get(1).unwrap().unwrap().id, id2);
}

// ===== Admin setter tests =====

#[test]
fn test_set_skin_count() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    assert_eq!(client.get_skin_count(), 10);

    client.set_skin_count(&20u64);
    assert_eq!(client.get_skin_count(), 20);
}

#[test]
fn test_set_drand_public_key() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    // Original is 192 zero bytes
    let original = client.get_drand_public_key();
    assert_eq!(original.len(), 192);

    // Update to different 192-byte key
    let new_key = Bytes::from_array(&env, &[0xff; 192]);
    client.set_drand_public_key(&new_key);
    assert_eq!(client.get_drand_public_key(), new_key);
}

#[test]
#[should_panic(expected = "Drand public key must be 192 bytes")]
fn test_set_drand_public_key_wrong_length() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let client = setup_contract(&env, &admin, &xlm_token.address, true);

    let bad_key = Bytes::from_array(&env, &[0xff; 96]);
    client.set_drand_public_key(&bad_key);
}

// ===== Real BLS12-381 verification test =====

/// Real drand quicknet public key (192 bytes uncompressed G2, CAP-0059 byte order)
fn real_drand_pubkey(env: &Env) -> Bytes {
    Bytes::from_slice(
        env,
        &hex::decode(
            "03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a01a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b0e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f04515273"
        ).unwrap(),
    )
}

#[test]
fn test_real_bls_verification() {
    // Test with real drand quicknet round 27448023
    // This verifies the full BLS12-381 pairing check with authentic drand data
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    // Deploy with real drand pubkey and dev_mode=false for real verification
    let pubkey = real_drand_pubkey(&env);
    let contract_id = env.register(
        GeneSplicer,
        (&admin, &xlm_token.address, 10u64, false, pubkey),
    );
    let client = GeneSplicerClient::new(&env, &contract_id);

    // Mint a cartridge
    let cartridge_id = client.splice_genome(&user);
    let mut cartridge = client.get_cartridge(&cartridge_id).unwrap();

    // Override splice_round to match our real drand data (round 27448023)
    // In a real scenario the round would be assigned by the contract based on ledger time.
    // For testing we need to match the round to the drand data we have.
    cartridge.splice_round = 27448023;
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(
            &crate::DataKey::Cartridge(cartridge_id),
            &cartridge,
        );
    });

    // Real drand round 27448023 data:
    let randomness = Bytes::from_slice(
        &env,
        &hex::decode("f22d19a3d8cd3a181fe8155d051fe006a726b1fe0b18043bda3a2fe4c6c1e5d8").unwrap(),
    );
    let sig_compressed = Bytes::from_slice(
        &env,
        &hex::decode("967e8a7aa839aa8f672800bb50b1ee29dfa4757d120112c7b858b1f625193a41fb156ad7c69fefc644b9719f88d60313").unwrap(),
    );
    let sig_uncompressed = Bytes::from_slice(
        &env,
        &hex::decode("167e8a7aa839aa8f672800bb50b1ee29dfa4757d120112c7b858b1f625193a41fb156ad7c69fefc644b9719f88d603130165791da033fb75626a46b01aeb3e1207d87423db1b5de2dabeb60ee4cc227f750d10de8ec1f77dedd4f311586e5c3e").unwrap(),
    );

    // This performs REAL BLS12-381 pairing verification on-chain
    let creature_id = client.finalize_splice(
        &cartridge_id,
        &27448023u64,
        &randomness,
        &sig_compressed,
        &sig_uncompressed,
    );

    assert_eq!(creature_id, cartridge_id);

    // Verify creature was created with genes derived from real entropy
    let creature = client.get_creature(&creature_id).unwrap();
    assert!(creature.head_gene.id <= 14);
    assert!(creature.body_gene.id <= 14);
    assert!(creature.legs_gene.id <= 14);
}

#[test]
#[should_panic]
fn test_real_bls_rejects_invalid_signature() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    // Deploy with real drand pubkey and dev_mode=false
    let pubkey = real_drand_pubkey(&env);
    let contract_id = env.register(
        GeneSplicer,
        (&admin, &xlm_token.address, 10u64, false, pubkey),
    );
    let client = GeneSplicerClient::new(&env, &contract_id);

    let cartridge_id = client.splice_genome(&user);
    let mut cartridge = client.get_cartridge(&cartridge_id).unwrap();
    cartridge.splice_round = 27448023;
    env.as_contract(&contract_id, || {
        env.storage().persistent().set(
            &crate::DataKey::Cartridge(cartridge_id),
            &cartridge,
        );
    });

    // Valid format but WRONG signature data (all 0x11)
    let randomness = Bytes::from_array(&env, &[0x42; 32]);
    // Build a fake compressed sig that matches fake uncompressed x-coord
    let mut fake_compressed = [0x11_u8; 48];
    fake_compressed[0] = 0x80 | 0x11; // Set compression flag
    let mut fake_uncompressed = [0x22_u8; 96];
    fake_uncompressed[0] = 0x11; // Match x-coord byte 0
    for i in 1..48 {
        fake_uncompressed[i] = 0x11; // Match x-coord
    }
    let sig_compressed = Bytes::from_array(&env, &fake_compressed);
    let sig_uncompressed = Bytes::from_array(&env, &fake_uncompressed);

    // Should panic during BLS verification (invalid signature)
    client.finalize_splice(
        &cartridge_id,
        &27448023u64,
        &randomness,
        &sig_compressed,
        &sig_uncompressed,
    );
}
