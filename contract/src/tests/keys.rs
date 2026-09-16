use soroban_sdk::Address;
use soroban_sdk::testutils::{Address as _, Ledger};

use super::utils::*;
use crate::errors::MembershipError;
use crate::{events, types};

#[test]
fn test_rotate_key() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let member = setup.contract.member(&token_id);
    let new_key = Address::generate(e);
    let call = args(e, (token_id, new_key.clone()));
    setup
        .contract
        .propose_recovery(&token_id, &Address::generate(e));

    // the current and the new key both sign
    for address in [&setup.grogu, &new_key] {
        mock_auths(&setup, &[(address, "rotate_key", call.clone())]);
        assert!(setup.contract.try_rotate_key(&token_id, &new_key).is_err());
    }
    e.mock_all_auths();
    setup.contract.rotate_key(&token_id, &new_key);
    assert_events(
        &setup,
        &[
            &events::RecoveryCancelled { token_id },
            &events::KeyRotated {
                token_id,
                from: setup.grogu.clone(),
                to: new_key.clone(),
            },
        ],
    );
    assert_authorized(&setup, &setup.grogu, "rotate_key", call.clone());
    assert_authorized(&setup, &new_key, "rotate_key", call);

    // same identity, new key
    assert_eq!(setup.contract.owner_of(&token_id), new_key);
    assert_eq!(setup.contract.token_of(&new_key), Some(token_id));
    assert_eq!(setup.contract.token_of(&setup.grogu), None);
    assert_eq!(setup.contract.member(&token_id), member);
    assert_eq!(setup.contract.recovery(&token_id), None);

    // the old key can onboard as a different person
    assert_eq!(mint(&setup, &setup.grogu, "2"), 1);
}

#[test]
fn test_rotate_key_errors() {
    let setup = create_test_data();
    let token_id = mint(&setup, &setup.grogu, "1");
    mint(&setup, &setup.mando, "2");
    let rotate = |token_id: u32, to: &Address| {
        setup
            .contract
            .try_rotate_key(&token_id, to)
            .unwrap_err()
            .unwrap()
    };

    assert_eq!(
        rotate(token_id, &setup.mando),
        MembershipError::MemberAlreadyExist.into()
    );
    assert_eq!(
        rotate(token_id, &setup.grogu),
        MembershipError::MemberAlreadyExist.into()
    );
    assert_eq!(
        rotate(42, &setup.attester),
        MembershipError::NonExistentToken.into()
    );
    setup.contract.revoke(&token_id);
    assert_eq!(
        rotate(token_id, &setup.attester),
        MembershipError::TokenRevoked.into()
    );
}

#[test]
fn test_propose_recovery() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    mint(&setup, &setup.mando, "2");
    let new_key = Address::generate(e);
    let call = args(e, (token_id, new_key.clone()));

    // the attester alone cannot direct a token to an address it does not
    // control, and nobody can propose without the attester
    for address in [&setup.attester, &new_key, &setup.admin] {
        mock_auths(&setup, &[(address, "propose_recovery", call.clone())]);
        assert!(
            setup
                .contract
                .try_propose_recovery(&token_id, &new_key)
                .is_err()
        );
    }
    e.mock_all_auths();

    let err = setup
        .contract
        .try_propose_recovery(&42, &new_key)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::NonExistentToken.into());
    let err = setup
        .contract
        .try_propose_recovery(&token_id, &setup.mando)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::MemberAlreadyExist.into());

    setup.contract.propose_recovery(&token_id, &new_key);
    let executable_at = 1_000 + types::RECOVERY_DELAY;
    assert_events(
        &setup,
        &[&events::RecoveryProposed {
            token_id,
            new_address: new_key.clone(),
            executable_at,
        }],
    );
    assert_authorized(&setup, &setup.attester, "propose_recovery", call.clone());
    assert_authorized(&setup, &new_key, "propose_recovery", call);
    assert_eq!(
        setup.contract.recovery(&token_id),
        Some(types::RecoveryRequest {
            new_address: new_key,
            executable_at,
        })
    );

    let err = setup
        .contract
        .try_propose_recovery(&token_id, &Address::generate(e))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::RecoveryPending.into());
}

#[test]
fn test_recovery_after_delay() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let member = setup.contract.member(&token_id);
    let new_key = Address::generate(e);
    setup.contract.propose_recovery(&token_id, &new_key);
    let executable_at = 1_000 + types::RECOVERY_DELAY;

    // the current key keeps the token during the delay
    assert_eq!(setup.contract.owner_of(&token_id), setup.grogu);
    e.ledger().set_timestamp(executable_at - 1);
    mock_auths(&setup, &[]);
    assert!(setup.contract.try_finalize_recovery(&token_id).is_err());

    // anyone can finalize once the delay elapsed
    e.ledger().set_timestamp(executable_at);
    setup.contract.finalize_recovery(&token_id);
    assert!(e.auths().is_empty());
    assert_events(
        &setup,
        &[&events::Recovered {
            token_id,
            from: Some(setup.grogu.clone()),
            to: new_key.clone(),
        }],
    );
    assert_eq!(setup.contract.owner_of(&token_id), new_key);
    assert_eq!(setup.contract.token_of(&setup.grogu), None);
    assert_eq!(setup.contract.recovery(&token_id), None);
    assert_eq!(setup.contract.member(&token_id), member);

    e.mock_all_auths();
    let err = setup
        .contract
        .try_finalize_recovery(&token_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::NoRecovery.into());

    // the target became a member in the meantime
    setup.contract.propose_recovery(&token_id, &setup.mando);
    mint(&setup, &setup.mando, "2");
    e.ledger()
        .set_timestamp(executable_at + types::RECOVERY_DELAY);
    let err = setup
        .contract
        .try_finalize_recovery(&token_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::MemberAlreadyExist.into());
}

#[test]
fn test_admin_approves_recovery_early() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let new_key = Address::generate(e);
    setup.contract.propose_recovery(&token_id, &new_key);
    let call = args(e, (token_id,));

    for address in [&setup.attester, &new_key, &setup.grogu] {
        mock_auths(&setup, &[(address, "finalize_recovery", call.clone())]);
        assert!(setup.contract.try_finalize_recovery(&token_id).is_err());
    }

    e.mock_all_auths();
    setup.contract.finalize_recovery(&token_id);
    assert_events(
        &setup,
        &[&events::Recovered {
            token_id,
            from: Some(setup.grogu.clone()),
            to: new_key.clone(),
        }],
    );
    assert_authorized(&setup, &setup.admin, "finalize_recovery", call);
    assert_eq!(setup.contract.owner_of(&token_id), new_key);
    assert_eq!(setup.contract.recovery(&token_id), None);
}

#[test]
fn test_cancel_recovery() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    let attacker = Address::generate(e);

    for caller in [&setup.grogu, &setup.admin] {
        setup.contract.propose_recovery(&token_id, &attacker);
        setup.contract.cancel_recovery(caller, &token_id);
        assert_events(&setup, &[&events::RecoveryCancelled { token_id }]);
        assert_authorized(
            &setup,
            caller,
            "cancel_recovery",
            args(e, (caller.clone(), token_id)),
        );
        assert_eq!(setup.contract.recovery(&token_id), None);
    }

    let err = setup
        .contract
        .try_cancel_recovery(&setup.grogu, &token_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::NoRecovery.into());

    // neither the attester nor the proposed address can cancel
    setup.contract.propose_recovery(&token_id, &attacker);
    for caller in [&setup.attester, &attacker] {
        let err = setup
            .contract
            .try_cancel_recovery(caller, &token_id)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, MembershipError::UnauthorizedSigner.into());
    }

    // a cancelled recovery cannot be finalized after the delay
    e.ledger().set_timestamp(1_000 + types::RECOVERY_DELAY);
    setup.contract.cancel_recovery(&setup.grogu, &token_id);
    let err = setup
        .contract
        .try_finalize_recovery(&token_id)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::NoRecovery.into());
}

#[test]
fn test_admin_recover() {
    let setup = create_test_data();
    let e = &setup.env;
    let token_id = mint(&setup, &setup.grogu, "1");
    mint(&setup, &setup.mando, "2");
    let new_key = Address::generate(e);
    let call = args(e, (token_id, new_key.clone()));
    setup
        .contract
        .propose_recovery(&token_id, &Address::generate(e));

    for address in [&new_key, &setup.attester, &setup.grogu] {
        mock_auths(&setup, &[(address, "recover", call.clone())]);
        assert!(setup.contract.try_recover(&token_id, &new_key).is_err());
    }
    e.mock_all_auths();

    let err = setup
        .contract
        .try_recover(&42, &new_key)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::NonExistentToken.into());
    let err = setup
        .contract
        .try_recover(&token_id, &setup.mando)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::MemberAlreadyExist.into());

    // a direct move supersedes the pending recovery, the new key does not sign
    setup.contract.recover(&token_id, &new_key);
    assert_events(
        &setup,
        &[
            &events::RecoveryCancelled { token_id },
            &events::Recovered {
                token_id,
                from: Some(setup.grogu.clone()),
                to: new_key.clone(),
            },
        ],
    );
    assert_authorized(&setup, &setup.admin, "recover", call);
    assert!(e.auths().iter().all(|(address, _)| address != &new_key));
    assert_eq!(setup.contract.owner_of(&token_id), new_key);
    assert_eq!(setup.contract.token_of(&setup.grogu), None);
    assert_eq!(setup.contract.recovery(&token_id), None);
}
