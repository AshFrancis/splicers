#![cfg(test)]

use crate::{GeneSplicer, GeneSplicerClient};
use soroban_sdk::{testutils::Address as _, token, Address, Env};

fn create_xlm_token<'a>(env: &Env, admin: &Address) -> token::StellarAssetClient<'a> {
    let asset_contract = env.register_stellar_asset_contract_v2(admin.clone());
    token::StellarAssetClient::new(env, &asset_contract.address())
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

    // Initialize
    client.initialize(&admin, &xlm_token.address, &10u64);

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
    client.initialize(&admin, &xlm_token.address, &10u64);

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
    client.initialize(&admin, &xlm_token.address, &10u64);

    // Verify admin
    assert_eq!(client.admin(), admin);

    // Update admin
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}
