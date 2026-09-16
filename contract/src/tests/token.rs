use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, String, vec};

use super::utils::*;
use crate::errors::MembershipError;
use crate::{events, types};

#[test]
fn test_metadata() {
    let setup = create_test_data();
    let e = &setup.env;

    assert_eq!(
        setup.contract.name(),
        String::from_str(e, "Stellar Members")
    );
    assert_eq!(setup.contract.symbol(), String::from_str(e, "SMBR"));
    assert_eq!(
        setup.contract.trait_metadata_uri(),
        String::from_str(e, "ipfs://wxyz")
    );
    assert_eq!(setup.contract.admin(), setup.admin);
    assert_eq!(setup.contract.attester(), setup.attester);
    assert_eq!(setup.contract.next_token_id(), 0);
    // metadata.json maps the role values
    assert_eq!(types::Role::Pilot as i128, 3);
}

#[test]
fn test_mint() {
    let setup = create_test_data();
    let e = &setup.env;

    let role = types::Role::Pilot;
    let external_accounts = accounts(e, "1");
    let token_id = setup.contract.mint(
        &setup.grogu,
        &role,
        &external_accounts,
        &bio(e),
        &projects(e, 2),
    );
    assert_eq!(token_id, 0);

    assert_events(
        &setup,
        &[&events::Minted {
            token_id,
            to: setup.grogu.clone(),
            role,
            external_accounts: external_accounts.clone(),
            bio: bio(e),
            projects: projects(e, 2),
        }],
    );

    // the member consents and the attester vouches only for the verified data
    assert_authorized(
        &setup,
        &setup.grogu,
        "mint",
        args(
            e,
            (
                setup.grogu.clone(),
                role,
                external_accounts.clone(),
                bio(e),
                projects(e, 2),
            ),
        ),
    );
    assert_authorized(
        &setup,
        &setup.attester,
        "mint",
        args(e, (setup.grogu.clone(), role, external_accounts.clone())),
    );

    assert_eq!(setup.contract.owner_of(&token_id), setup.grogu);
    assert_eq!(setup.contract.token_of(&setup.grogu), Some(token_id));
    assert_eq!(setup.contract.balance(&setup.grogu), 1);
    assert_eq!(setup.contract.balance(&setup.mando), 0);
    assert_eq!(setup.contract.token_of(&setup.mando), None);
    assert_eq!(setup.contract.next_token_id(), 1);
    assert_eq!(
        setup.contract.member(&token_id),
        types::Member {
            status: types::Status::Active,
            role,
            external_accounts,
            bio: bio(e),
            projects: projects(e, 2),
        }
    );
    assert_eq!(
        setup.contract.token_by_account(
            &types::Provider::Discord,
            &String::from_str(e, &discord_id("1"))
        ),
        Some(token_id)
    );
    assert_eq!(
        setup
            .contract
            .token_by_account(&types::Provider::X, &String::from_str(e, "1")),
        None
    );

    assert_eq!(mint(&setup, &setup.mando, "2"), 1);
    assert_eq!(setup.contract.next_token_id(), 2);
}

#[test]
fn test_mint_requires_attested_data() {
    let setup = create_test_data();
    let e = &setup.env;
    let attested = accounts(e, "1");
    let member_args = |role: types::Role, external_accounts: &types::ExternalAccounts| {
        args(
            e,
            (
                setup.grogu.clone(),
                role,
                external_accounts.clone(),
                bio(e),
                projects(e, 2),
            ),
        )
    };
    let attester_args = args(
        e,
        (setup.grogu.clone(), types::Role::Verified, attested.clone()),
    );
    let try_mint = |role: types::Role, external_accounts: &types::ExternalAccounts| {
        setup.contract.try_mint(
            &setup.grogu,
            &role,
            external_accounts,
            &bio(e),
            &projects(e, 2),
        )
    };

    // the attester alone
    mock_auths(&setup, &[(&setup.attester, "mint", attester_args.clone())]);
    assert!(try_mint(types::Role::Verified, &attested).is_err());

    // the member alone
    mock_auths(
        &setup,
        &[(
            &setup.grogu,
            "mint",
            member_args(types::Role::Verified, &attested),
        )],
    );
    assert!(try_mint(types::Role::Verified, &attested).is_err());

    // the admin cannot stand in for the attester
    mock_auths(
        &setup,
        &[
            (
                &setup.grogu,
                "mint",
                member_args(types::Role::Verified, &attested),
            ),
            (&setup.admin, "mint", attester_args.clone()),
        ],
    );
    assert!(try_mint(types::Role::Verified, &attested).is_err());

    // a role the attester did not grant
    mock_auths(
        &setup,
        &[
            (
                &setup.grogu,
                "mint",
                member_args(types::Role::Pilot, &attested),
            ),
            (&setup.attester, "mint", attester_args.clone()),
        ],
    );
    assert!(try_mint(types::Role::Pilot, &attested).is_err());

    // accounts the attester did not verify
    let forged = accounts(e, "2");
    mock_auths(
        &setup,
        &[
            (
                &setup.grogu,
                "mint",
                member_args(types::Role::Verified, &forged),
            ),
            (&setup.attester, "mint", attester_args.clone()),
        ],
    );
    assert!(try_mint(types::Role::Verified, &forged).is_err());

    // both, over the same data
    mock_auths(
        &setup,
        &[
            (
                &setup.grogu,
                "mint",
                member_args(types::Role::Verified, &attested),
            ),
            (&setup.attester, "mint", attester_args),
        ],
    );
    assert!(try_mint(types::Role::Verified, &attested).is_ok());
}

#[test]
fn test_mint_rejects_duplicates() {
    let setup = create_test_data();
    let e = &setup.env;
    mint(&setup, &setup.grogu, "1");
    let try_mint = |to: &Address, external_accounts: &types::ExternalAccounts| {
        setup
            .contract
            .try_mint(
                to,
                &types::Role::Verified,
                external_accounts,
                &bio(e),
                &projects(e, 0),
            )
            .unwrap_err()
            .unwrap()
    };

    assert_eq!(
        try_mint(&setup.grogu, &accounts(e, "2")),
        MembershipError::MemberAlreadyExist.into()
    );

    // the Discord account of member #0 with another GitHub
    let bound = types::ExternalAccounts {
        accounts: vec![
            e,
            account(e, types::Provider::Discord, &discord_id("1"), "grogu"),
            account(e, types::Provider::Github, "2", "mando"),
        ],
        email_hash: None,
    };
    assert_eq!(
        try_mint(&setup.mando, &bound),
        MembershipError::AccountAlreadyBound.into()
    );

    let mut duplicate = accounts(e, "2");
    duplicate
        .accounts
        .push_back(account(e, types::Provider::Github, "3", "other"));
    assert_eq!(
        try_mint(&setup.mando, &duplicate),
        MembershipError::DuplicateProvider.into()
    );
}

#[test]
fn test_mint_validates_lengths() {
    let setup = create_test_data();
    let e = &setup.env;
    let try_mint = |projects: &soroban_sdk::Vec<String>| {
        setup
            .contract
            .try_mint(
                &setup.grogu,
                &types::Role::Verified,
                &accounts(e, "1"),
                &bio(e),
                projects,
            )
            .unwrap_err()
            .unwrap()
    };

    assert_eq!(
        try_mint(&projects(e, types::MAX_PROJECTS + 1)),
        MembershipError::TooManyProjects.into()
    );
    let mut too_long = projects(e, 1);
    too_long.push_back(String::from_str(e, &"p".repeat(129)));
    assert_eq!(try_mint(&too_long), MembershipError::InvalidLength.into());
}

#[test]
fn test_set_attester() {
    let setup = create_test_data();
    let e = &setup.env;
    let new_attester = Address::generate(e);

    mock_auths(&setup, &[]);
    assert!(setup.contract.try_set_attester(&new_attester).is_err());

    e.mock_all_auths();
    setup.contract.set_attester(&new_attester);
    assert_events(
        &setup,
        &[&events::AttesterSet {
            attester: new_attester.clone(),
        }],
    );
    assert_authorized(
        &setup,
        &setup.admin,
        "set_attester",
        args(e, (new_attester.clone(),)),
    );
    assert_eq!(setup.contract.attester(), new_attester);

    // the previous attester cannot vouch anymore
    let external_accounts = accounts(e, "1");
    mock_auths(
        &setup,
        &[
            (
                &setup.grogu,
                "mint",
                args(
                    e,
                    (
                        setup.grogu.clone(),
                        types::Role::Verified,
                        external_accounts.clone(),
                        bio(e),
                        projects(e, 2),
                    ),
                ),
            ),
            (
                &setup.attester,
                "mint",
                args(
                    e,
                    (
                        setup.grogu.clone(),
                        types::Role::Verified,
                        external_accounts.clone(),
                    ),
                ),
            ),
        ],
    );
    assert!(
        setup
            .contract
            .try_mint(
                &setup.grogu,
                &types::Role::Verified,
                &external_accounts,
                &bio(e),
                &projects(e, 2),
            )
            .is_err()
    );
}

#[test]
fn test_revoke() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let attacker = Address::generate(e);
    setup.contract.propose_recovery(&token_id, &attacker);

    mock_auths(&setup, &[]);
    assert!(setup.contract.try_revoke(&token_id).is_err());
    e.mock_all_auths();
    let err = setup.contract.try_revoke(&42).unwrap_err().unwrap();
    assert_eq!(err, MembershipError::NonExistentToken.into());

    setup.contract.revoke(&token_id);
    assert_events(
        &setup,
        &[
            &events::RecoveryCancelled { token_id },
            &events::Revoked {
                token_id,
                from: setup.grogu.clone(),
            },
        ],
    );
    assert_authorized(&setup, &setup.admin, "revoke", args(e, (token_id,)));

    // the record is kept, the address is released
    let member = setup.contract.member(&token_id);
    assert_eq!(member.status, types::Status::Revoked);
    assert_eq!(setup.contract.token_of(&setup.grogu), None);
    assert_eq!(setup.contract.balance(&setup.grogu), 0);
    assert_eq!(setup.contract.recovery(&token_id), None);

    // the accounts stay bound: no new identity with them
    assert_eq!(
        setup.contract.token_by_account(
            &types::Provider::Discord,
            &String::from_str(e, &discord_id("1"))
        ),
        Some(token_id)
    );
    let err = setup
        .contract
        .try_mint(
            &setup.grogu,
            &types::Role::Verified,
            &accounts(e, "1"),
            &bio(e),
            &projects(e, 0),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::AccountAlreadyBound.into());

    // nothing but a reinstatement works on a revoked token
    let revoked: [Result<(), MembershipError>; 6] = [
        setup.contract.try_owner_of(&token_id).map(|_| ()),
        setup.contract.try_governance(&token_id).map(|_| ()),
        setup
            .contract
            .try_set_role(&token_id, &types::Role::Pilot)
            .map(|_| ()),
        setup
            .contract
            .try_set_bio(&setup.grogu, &token_id, &bio(e))
            .map(|_| ()),
        setup
            .contract
            .try_propose_recovery(&token_id, &attacker)
            .map(|_| ()),
        setup.contract.try_revoke(&token_id).map(|_| ()),
    ]
    .map(|result| result.map_err(|err| err.unwrap().try_into().unwrap()));
    for result in revoked {
        assert_eq!(result, Err(MembershipError::TokenRevoked));
    }
}

#[test]
fn test_recover_reinstates_revoked() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    setup.contract.revoke(&token_id);

    let new_key = Address::generate(e);
    setup.contract.recover(&token_id, &new_key);
    assert_events(
        &setup,
        &[&events::Recovered {
            token_id,
            from: None,
            to: new_key.clone(),
        }],
    );

    assert_eq!(setup.contract.owner_of(&token_id), new_key);
    assert_eq!(
        setup.contract.member(&token_id).status,
        types::Status::Active
    );
}
