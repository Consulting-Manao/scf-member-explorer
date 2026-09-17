use soroban_sdk::testutils::storage::{Instance as _, Persistent as _};
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, String};

use super::utils::*;
use crate::errors::MembershipError;
use crate::types::{
    self, INSTANCE_TTL_EXTEND_TO, MemberKey, PERSISTENT_TTL_EXTEND_TO, PERSISTENT_TTL_THRESHOLD,
};

fn ttl(setup: &TestSetup, key: &MemberKey) -> u32 {
    setup.env.as_contract(&setup.contract_id, || {
        setup.env.storage().persistent().get_ttl(key)
    })
}

fn instance_ttl(setup: &TestSetup) -> u32 {
    setup.env.as_contract(&setup.contract_id, || {
        setup.env.storage().instance().get_ttl()
    })
}

fn member_keys(setup: &TestSetup, token_id: u32, owner: &Address) -> [MemberKey; 4] {
    let e = &setup.env;
    [
        MemberKey::Member(token_id),
        MemberKey::Owner(token_id),
        MemberKey::TokenOf(owner.clone()),
        MemberKey::Account(
            types::Provider::Discord,
            String::from_str(e, &discord_id("1")),
        ),
    ]
}

#[test]
fn test_ttl_extended_on_writes() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");

    for key in member_keys(&setup, token_id, &setup.grogu) {
        assert_eq!(ttl(&setup, &key), PERSISTENT_TTL_EXTEND_TO);
    }
    assert_eq!(instance_ttl(&setup), INSTANCE_TTL_EXTEND_TO);

    // below the threshold, any write to the member extends all its entries
    let elapsed = PERSISTENT_TTL_EXTEND_TO - PERSISTENT_TTL_THRESHOLD + 1;
    e.ledger().with_mut(|li| li.sequence_number += elapsed);
    for key in member_keys(&setup, token_id, &setup.grogu) {
        assert_eq!(ttl(&setup, &key), PERSISTENT_TTL_THRESHOLD - 1);
    }

    setup.contract.set_bio(&setup.grogu, &token_id, &bio(e));
    for key in member_keys(&setup, token_id, &setup.grogu) {
        assert_eq!(ttl(&setup, &key), PERSISTENT_TTL_EXTEND_TO);
    }
    assert_eq!(instance_ttl(&setup), INSTANCE_TTL_EXTEND_TO);

    setup
        .contract
        .propose_recovery(&token_id, &Address::generate(e));
    assert_eq!(
        ttl(&setup, &MemberKey::Recovery(token_id)),
        PERSISTENT_TTL_EXTEND_TO
    );
}

#[test]
fn test_extend_member_carries_a_revoked_record() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    setup.contract.revoke(&token_id);

    // a revoked token takes no writes, so nothing else can carry its
    // record and the accounts it still reserves forward
    let record = [
        MemberKey::Member(token_id),
        MemberKey::Account(
            types::Provider::Discord,
            String::from_str(e, &discord_id("1")),
        ),
    ];
    let elapsed = PERSISTENT_TTL_EXTEND_TO - PERSISTENT_TTL_THRESHOLD + 1;
    e.ledger().with_mut(|li| li.sequence_number += elapsed);
    for key in &record {
        assert_eq!(ttl(&setup, key), PERSISTENT_TTL_THRESHOLD - 1);
    }

    // anyone can, with nobody signing
    mock_auths(&setup, &[]);
    setup.contract.extend_member(&token_id);
    assert!(e.auths().is_empty());
    for key in &record {
        assert_eq!(ttl(&setup, key), PERSISTENT_TTL_EXTEND_TO);
    }
    // the address was released, so there is no link left to extend
    assert_eq!(setup.contract.token_of(&setup.grogu), None);

    e.mock_all_auths();
    let err = setup.contract.try_extend_member(&42).unwrap_err().unwrap();
    assert_eq!(err, MembershipError::NonExistentToken.into());
}
