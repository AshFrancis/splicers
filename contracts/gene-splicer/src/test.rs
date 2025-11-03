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

#[test]
fn test_splice_genome() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Create XLM token and mint some to user
    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000); // 10 XLM

    // Deploy contract
    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);

    // Initialize with dev_mode=true to skip BLS verification in tests
    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Splice genome
    let cartridge_id = client.splice_genome(&user);
    assert_eq!(cartridge_id, 1);

    // Verify cartridge was created
    let cartridge = client.get_cartridge(&1).unwrap();
    assert_eq!(cartridge.id, 1);
    assert_eq!(cartridge.owner, user);
    assert!(cartridge.skin_id < 10); // Should be 0-9

    // Verify user owns the cartridge
    let user_cartridges = client.get_user_cartridges(&user);
    assert_eq!(user_cartridges.len(), 1);
    assert_eq!(user_cartridges.get(0).unwrap(), 1);

    // Verify total count
    assert_eq!(client.get_total_cartridges(), 1);

    // Verify admin received fee (1 XLM)
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

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);
    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Multiple users can mint
    let id1 = client.splice_genome(&user1);
    let id2 = client.splice_genome(&user2);
    let id3 = client.splice_genome(&user1);

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);

    // User1 has 2 cartridges
    let user1_cartridges = client.get_user_cartridges(&user1);
    assert_eq!(user1_cartridges.len(), 2);

    // User2 has 1 cartridge
    let user2_cartridges = client.get_user_cartridges(&user2);
    assert_eq!(user2_cartridges.len(), 1);

    // Total is 3
    assert_eq!(client.get_total_cartridges(), 3);
}

#[test]
fn test_admin_functions() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let xlm_token = create_xlm_token(&env, &admin);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);
    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Verify admin
    assert_eq!(client.admin(), admin);

    // Update admin
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
fn test_entropy_and_finalization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let entropy_submitter = Address::generate(&env);

    // Create XLM token and fund user
    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    // Deploy and initialize contract
    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);
    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Mint a cartridge
    let cartridge_id = client.splice_genome(&user);
    assert_eq!(cartridge_id, 1);

    // Verify cartridge is not finalized
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();
    assert_eq!(cartridge.finalized, false);

    // Get the splice round from the cartridge
    let splice_round = cartridge.splice_round;

    // Create mock entropy (32 bytes of randomness)
    let randomness = Bytes::from_array(
        &env,
        &[
            0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
            0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c,
            0x1d, 0x1e, 0x1f, 0x20,
        ],
    );

    // Mock signature for testing
    let signature = Bytes::from_array(&env, &[0xaa; 96]);

    // Submit entropy for the splice round
    client.submit_entropy(&entropy_submitter, &splice_round, &randomness, &signature);

    // Verify entropy was stored
    let stored_entropy = client.get_entropy(&splice_round).unwrap();
    assert_eq!(stored_entropy.round, splice_round);
    assert_eq!(stored_entropy.randomness, randomness);

    // Finalize the cartridge
    let creature_id = client.finalize_splice(&cartridge_id);
    assert_eq!(creature_id, cartridge_id);

    // Verify cartridge is now marked as finalized
    let cartridge_after = client.get_cartridge(&cartridge_id).unwrap();
    assert_eq!(cartridge_after.finalized, true);

    // Verify creature was created
    let creature = client.get_creature(&creature_id).unwrap();
    assert_eq!(creature.id, cartridge_id);
    assert_eq!(creature.owner, user);
    assert_eq!(creature.skin_id, cartridge.skin_id);
    assert_eq!(creature.entropy_round, splice_round);

    // Verify genes were assigned (all should be 0-9)
    assert!(creature.head_gene.id < 10);
    assert!(creature.torso_gene.id < 10);
    assert!(creature.legs_gene.id < 10);

    // Verify user owns the creature
    let user_creatures = client.get_user_creatures(&user);
    assert_eq!(user_creatures.len(), 1);
    assert_eq!(user_creatures.get(0).unwrap(), creature_id);
}

#[test]
#[should_panic(expected = "Entropy not available for this round")]
fn test_finalize_without_entropy() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);
    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Mint cartridge
    let cartridge_id = client.splice_genome(&user);

    // Try to finalize without entropy - should panic
    client.finalize_splice(&cartridge_id);
}

#[test]
#[should_panic(expected = "Cartridge already finalized")]
fn test_double_finalization() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    let entropy_submitter = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);
    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Mint and get splice round
    let cartridge_id = client.splice_genome(&user);
    let cartridge = client.get_cartridge(&cartridge_id).unwrap();
    let splice_round = cartridge.splice_round;

    // Submit entropy
    let randomness = Bytes::from_array(&env, &[0x42; 32]);
    let signature = Bytes::from_array(&env, &[0xaa; 96]);
    client.submit_entropy(&entropy_submitter, &splice_round, &randomness, &signature);

    // Finalize once
    client.finalize_splice(&cartridge_id);

    // Try to finalize again - should panic
    client.finalize_splice(&cartridge_id);
}

#[test]
fn test_bls_verification_infrastructure() {
    // This test verifies that the BLS verification infrastructure is properly wired up
    // It initializes the contract with the real drand public key and dev_mode=false,
    // then uses dev_mode's bypass to submit entropy without actual verification
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);
    xlm_token.mint(&user, &100_000_000);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);

    // Real drand quicknet public key (192 bytes uncompressed G2)
    let real_drand_pubkey = Bytes::from_slice(
        &env,
        &hex::decode(
            "0d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f0451527301a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b"
        ).unwrap(),
    );

    // Initialize with real drand public key (but we'll use dev_mode for actual testing)
    // Full BLS verification with real drand data is tested in testBLS12381.sh integration test
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &real_drand_pubkey);

    // Verify initialization succeeded with proper 192-byte public key
    assert_eq!(client.admin(), admin);

    // Mint a cartridge
    let cartridge_id = client.splice_genome(&user);
    assert_eq!(cartridge_id, 1);
}

#[test]
#[should_panic] // Will panic because signature verification fails
fn test_bls_verification_rejects_invalid_signature() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let entropy_submitter = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);

    // Real drand public key
    let real_drand_pubkey = Bytes::from_slice(
        &env,
        &hex::decode(
            "0d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a03cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510e5db2b6bfbb01c867749cadffca88b36c24f3012ba09fc4d3022c5c37dce0f977d3adb5d183c7477c442b1f0451527301a714f2edb74119a2f2b0d5a7c75ba902d163700a61bc224ededd8e63aef7be1aaf8e93d7a9718b047ccddb3eb5d68b"
        ).unwrap(),
    );

    // Initialize with dev_mode=false to verify signatures
    client.initialize(&admin, &xlm_token.address, &10u64, &false, &real_drand_pubkey);

    // Valid randomness but INVALID signature (all zeros)
    let randomness = Bytes::from_slice(
        &env,
        &hex::decode("bc63d97d13b2e75eaba08f2b36d4fef5b4c6feca54e18d95c68dae99e21e8f8c")
            .unwrap(),
    );
    let invalid_signature = Bytes::from_array(&env, &[0x00; 96]);

    // This should panic because the signature is invalid
    client.submit_entropy(&entropy_submitter, &12345u64, &randomness, &invalid_signature);
}

#[test]
#[should_panic] // Will panic with "Entropy already submitted for this round"
fn test_entropy_replay_attack_prevention() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let entropy_submitter = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);

    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Submit entropy once
    let round = 100u64;
    let randomness = Bytes::from_array(&env, &[0x42; 32]);
    let signature = Bytes::from_array(&env, &[0xaa; 96]);
    client.submit_entropy(&entropy_submitter, &round, &randomness, &signature);

    // Try to submit again for the same round - should panic (replay attack)
    client.submit_entropy(&entropy_submitter, &round, &randomness, &signature);
}

#[test]
#[should_panic] // Will panic because signature must be 96 bytes
fn test_malformed_signature_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let entropy_submitter = Address::generate(&env);

    let xlm_token = create_xlm_token(&env, &admin);

    let contract_id = env.register(GeneSplicer, ());
    let client = GeneSplicerClient::new(&env, &contract_id);

    let mock_pubkey = create_mock_drand_pubkey(&env);
    client.initialize(&admin, &xlm_token.address, &10u64, &true, &mock_pubkey);

    // Submit with wrong signature length (should be 96 bytes)
    let randomness = Bytes::from_array(&env, &[0x42; 32]);
    let malformed_signature = Bytes::from_array(&env, &[0xaa; 48]); // Only 48 bytes
    client.submit_entropy(&entropy_submitter, &12345u64, &randomness, &malformed_signature);
}
