use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, BytesN, String};

use super::utils::{nqg, *};
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
            previous_attester: setup.attester.clone(),
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
fn test_upgrade_is_admin_only() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let wasm_hash = BytesN::from_array(e, &[9; 32]);
    let call = args(e, (wasm_hash.clone(),));

    // nobody signing, and nobody but the admin signing
    mock_auths(&setup, &[]);
    assert!(setup.contract.try_upgrade(&wasm_hash).is_err());
    for address in [&setup.attester, &setup.grogu] {
        mock_auths(&setup, &[(address, "upgrade", call.clone())]);
        assert!(setup.contract.try_upgrade(&wasm_hash).is_err());
    }

    // the member's record is untouched by the refused calls
    e.mock_all_auths();
    assert_eq!(setup.contract.owner_of(&token_id), setup.grogu);
}

#[test]
fn test_set_admin() {
    let setup = create_test_data();
    let e = &setup.env;
    let new_admin = Address::generate(e);
    let token_id = mint(&setup, &setup.grogu, "1");
    let call = args(e, (new_admin.clone(),));

    // nobody signing, and nobody but the admin signing
    mock_auths(&setup, &[]);
    assert!(setup.contract.try_set_admin(&new_admin).is_err());
    for address in [&setup.attester, &new_admin] {
        mock_auths(&setup, &[(address, "set_admin", call.clone())]);
        assert!(setup.contract.try_set_admin(&new_admin).is_err());
    }

    e.mock_all_auths();
    setup.contract.set_admin(&new_admin);
    assert_events(
        &setup,
        &[&events::AdminSet {
            previous_admin: setup.admin.clone(),
            admin: new_admin.clone(),
        }],
    );
    assert_authorized(&setup, &setup.admin, "set_admin", call);
    assert_eq!(setup.contract.admin(), new_admin);

    // the previous admin has no say anymore
    mock_auths(&setup, &[(&setup.admin, "revoke", args(e, (token_id,)))]);
    assert!(setup.contract.try_revoke(&token_id).is_err());
}

#[test]
fn test_set_nqg_contract() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let previous = setup.contract.nqg_contract();
    let nqg_id = e.register(nqg::Mock, (setup.grogu.to_string(), nqg_score(e, 0)));
    let call = args(e, (nqg_id.clone(),));

    mock_auths(&setup, &[]);
    assert!(setup.contract.try_set_nqg_contract(&nqg_id).is_err());
    for address in [&setup.attester, &setup.grogu] {
        mock_auths(&setup, &[(address, "set_nqg_contract", call.clone())]);
        assert!(setup.contract.try_set_nqg_contract(&nqg_id).is_err());
    }

    e.mock_all_auths();
    setup.contract.set_nqg_contract(&nqg_id);
    assert_events(
        &setup,
        &[&events::NqgContractSet {
            previous_nqg_contract: previous,
            nqg_contract: nqg_id.clone(),
        }],
    );
    assert_authorized(&setup, &setup.admin, "set_nqg_contract", call);
    assert_eq!(setup.contract.nqg_contract(), nqg_id);
    // the score now comes from the new contract
    assert_eq!(setup.contract.governance(&token_id).nqg, 0);
}
