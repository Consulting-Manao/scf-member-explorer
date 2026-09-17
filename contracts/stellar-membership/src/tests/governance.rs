use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, I256, String, vec};

use super::utils::*;
use crate::errors::MembershipError;
use crate::types;

#[test]
fn test_governance() {
    let setup = create_test_data();
    let e = &setup.env;
    let role_key = String::from_str(e, "role");
    let nqg_key = String::from_str(e, "nqg");
    let trait_keys = vec![e, role_key.clone(), nqg_key.clone()];

    // no NQG score
    let mando_id = mint(&setup, &setup.mando, "2");
    assert_eq!(
        setup.contract.trait_values(&mando_id, &trait_keys),
        vec![e, 0, 0]
    );
    assert_eq!(
        setup.contract.token_uri(&mando_id),
        String::from_str(e, "ipfs://abcd/0")
    );

    let grogu_id = mint(&setup, &setup.grogu, "1");
    setup.contract.set_role(&grogu_id, &types::Role::Pilot);
    assert_eq!(
        setup.contract.token_uri(&grogu_id),
        String::from_str(e, "ipfs://abcd/3")
    );
    assert_eq!(setup.contract.trait_value(&grogu_id, &role_key), 3);
    assert_eq!(setup.contract.trait_value(&grogu_id, &nqg_key), 10_000_000);
    assert_eq!(
        setup.contract.governance(&grogu_id),
        types::Governance {
            role: types::Role::Pilot,
            nqg: 10_000_000
        }
    );

    // NQG is keyed by address upstream
    setup.contract.rotate_key(&grogu_id, &Address::generate(e));
    assert_eq!(setup.contract.trait_value(&grogu_id, &nqg_key), 0);

    let err = setup
        .contract
        .try_trait_value(&grogu_id, &String::from_str(e, "unknown"))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, MembershipError::TraitDoesNotExist.into());
    let err = setup.contract.try_governance(&42).unwrap_err().unwrap();
    assert_eq!(err, MembershipError::NonExistentToken.into());
}

#[test]
fn test_nqg_never_panics() {
    let setup = create_test_data();
    let e = &setup.env;
    let nqg_key = String::from_str(e, "nqg");
    let token_id = mint(&setup, &setup.grogu, "1");
    assert_eq!(setup.contract.trait_value(&token_id, &nqg_key), 10_000_000);

    // a score too large to scale down into an i128 reads as no score
    // rather than trapping, like every other unreadable score
    set_nqg_score(
        &setup,
        I256::from_parts(e, i64::MAX, u64::MAX, u64::MAX, u64::MAX),
    );
    assert_eq!(setup.contract.trait_value(&token_id, &nqg_key), 0);
    assert_eq!(setup.contract.governance(&token_id).nqg, 0);

    // so does a negative one, which is not a voting weight
    set_nqg_score(&setup, nqg_score(e, -PILOT_SCORE));
    assert_eq!(setup.contract.trait_value(&token_id, &nqg_key), 0);
    assert_eq!(setup.contract.governance(&token_id).nqg, 0);

    // and a score below the 6 decimals kept truncates to zero
    set_nqg_score(&setup, nqg_score(e, 999_999));
    assert_eq!(setup.contract.governance(&token_id).nqg, 0);
}
