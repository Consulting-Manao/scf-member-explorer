use soroban_sdk::{String, vec};

use super::utils::*;
use crate::errors::MembershipError;
use crate::{events, types};

#[test]
fn test_set_role() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let call = args(e, (token_id, types::Role::Navigator));

    for address in [&setup.grogu, &setup.attester] {
        mock_auths(&setup, &[(address, "set_role", call.clone())]);
        assert!(
            setup
                .contract
                .try_set_role(&token_id, &types::Role::Navigator)
                .is_err()
        );
    }

    e.mock_all_auths();
    setup.contract.set_role(&token_id, &types::Role::Navigator);
    assert_events(
        &setup,
        &[&events::RoleSet {
            token_id,
            role: types::Role::Navigator,
        }],
    );
    assert_authorized(&setup, &setup.admin, "set_role", call);
    assert_eq!(
        setup.contract.member(&token_id).role,
        types::Role::Navigator
    );

    let err = setup
        .contract
        .try_set_role(&42, &types::Role::Pilot)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::NonExistentToken.into());
}

#[test]
fn test_set_bio_and_projects() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    mint(&setup, &setup.mando, "2");

    let new_bio = String::from_str(e, "bafynewbio");
    setup.contract.set_bio(&setup.grogu, &token_id, &new_bio);
    assert_events(
        &setup,
        &[&events::BioSet {
            token_id,
            bio: new_bio.clone(),
        }],
    );
    assert_authorized(
        &setup,
        &setup.grogu,
        "set_bio",
        args(e, (setup.grogu.clone(), token_id, new_bio.clone())),
    );

    // replaced, not appended
    let new_projects = projects(e, 1);
    setup
        .contract
        .set_projects(&setup.grogu, &token_id, &new_projects);
    assert_events(
        &setup,
        &[&events::ProjectsSet {
            token_id,
            projects: new_projects.clone(),
        }],
    );
    let member = setup.contract.member(&token_id);
    assert_eq!(member.bio, new_bio);
    assert_eq!(member.projects, new_projects);

    // the admin moderates
    setup
        .contract
        .set_bio(&setup.admin, &token_id, &String::from_str(e, ""));
    setup
        .contract
        .set_projects(&setup.admin, &token_id, &projects(e, 0));
    let member = setup.contract.member(&token_id);
    assert_eq!(member.bio, String::from_str(e, ""));
    assert_eq!(member.projects.len(), 0);

    // another member, even authenticated, and the owner without signing
    let err = setup
        .contract
        .try_set_bio(&setup.mando, &token_id, &bio(e))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::UnauthorizedSigner.into());
    let err = setup
        .contract
        .try_set_projects(&setup.attester, &token_id, &projects(e, 1))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::UnauthorizedSigner.into());
    mock_auths(&setup, &[]);
    assert!(
        setup
            .contract
            .try_set_bio(&setup.grogu, &token_id, &bio(e))
            .is_err()
    );

    e.mock_all_auths();
    let err = setup
        .contract
        .try_set_projects(
            &setup.grogu,
            &token_id,
            &projects(e, types::MAX_PROJECTS + 1),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::TooManyProjects.into());
}

#[test]
fn test_set_external_accounts() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    mint(&setup, &setup.mando, "2");
    let by_account = |provider: types::Provider, id: &str| {
        setup
            .contract
            .token_by_account(&provider, &String::from_str(e, id))
    };

    // keep Discord, change GitHub, add X
    let new_accounts = types::ExternalAccounts {
        accounts: vec![
            e,
            account(e, types::Provider::Discord, &discord_id("1"), "grogu"),
            account(e, types::Provider::Github, "99", "grogu-new"),
            account(e, types::Provider::X, "77", "grogu_x"),
        ],
        email_hash: None,
    };
    let call = args(e, (token_id, new_accounts.clone()));

    // the owner and the attester both sign
    for address in [&setup.grogu, &setup.attester] {
        mock_auths(&setup, &[(address, "set_external_accounts", call.clone())]);
        assert!(
            setup
                .contract
                .try_set_external_accounts(&token_id, &new_accounts)
                .is_err()
        );
    }
    e.mock_all_auths();
    setup
        .contract
        .set_external_accounts(&token_id, &new_accounts);
    assert_events(
        &setup,
        &[&events::ExternalAccountsSet {
            token_id,
            external_accounts: new_accounts.clone(),
        }],
    );
    assert_authorized(&setup, &setup.grogu, "set_external_accounts", call.clone());
    assert_authorized(&setup, &setup.attester, "set_external_accounts", call);

    assert_eq!(
        setup.contract.member(&token_id).external_accounts,
        new_accounts
    );
    assert_eq!(
        by_account(types::Provider::Discord, &discord_id("1")),
        Some(token_id)
    );
    assert_eq!(by_account(types::Provider::Github, "1"), None);
    assert_eq!(by_account(types::Provider::Github, "99"), Some(token_id));
    assert_eq!(by_account(types::Provider::X, "77"), Some(token_id));

    // an account bound to another member
    let err = setup
        .contract
        .try_set_external_accounts(&token_id, &accounts(e, "2"))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::AccountAlreadyBound.into());

    // a released account can be bound by someone else
    let released = types::ExternalAccounts {
        accounts: vec![e, account(e, types::Provider::Github, "1", "third")],
        email_hash: None,
    };
    setup.contract.set_external_accounts(&1, &released);
    assert_eq!(by_account(types::Provider::Github, "1"), Some(1));
    assert_eq!(by_account(types::Provider::Discord, &discord_id("2")), None);
}
