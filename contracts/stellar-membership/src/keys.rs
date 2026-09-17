use crate::{
    CoreTrait, KeyTrait, MemberTrait, StellarMembership, StellarMembershipArgs,
    StellarMembershipClient, TokenTrait, errors, events, storage, types,
};
use soroban_sdk::{Address, Env, contractimpl, panic_with_error};

#[contractimpl]
impl KeyTrait for StellarMembership {
    fn rotate_key(e: &Env, token_id: u32, new_address: Address) {
        let from = Self::owner_of(e, token_id);
        from.require_auth();
        new_address.require_auth();
        storage::extend_instance(e);

        storage::cancel_recovery(e, token_id);
        storage::set_owner(e, token_id, Some(from.clone()), &new_address);
        Self::extend_member(e, token_id);

        events::KeyRotated {
            token_id,
            from,
            to: new_address,
        }
        .publish(e);
    }

    fn propose_recovery(e: &Env, token_id: u32, new_address: Address) {
        // panics unless the token exists and is active
        Self::owner_of(e, token_id);
        Self::attester(e).require_auth();
        new_address.require_auth();
        storage::extend_instance(e);

        if Self::recovery(e, token_id).is_some() {
            panic_with_error!(e, errors::MembershipError::RecoveryPending)
        }
        if e.storage()
            .persistent()
            .has(&types::MemberKey::TokenOf(new_address.clone()))
        {
            panic_with_error!(e, errors::MembershipError::MemberAlreadyExist)
        }

        let executable_at = e.ledger().timestamp() + types::RECOVERY_DELAY;
        storage::write(
            e,
            &types::MemberKey::Recovery(token_id),
            &types::RecoveryRequest {
                attester: Self::attester(e),
                new_address: new_address.clone(),
                executable_at,
            },
        );

        events::RecoveryProposed {
            token_id,
            new_address,
            executable_at,
        }
        .publish(e);
    }

    fn cancel_recovery(e: &Env, caller: Address, token_id: u32) {
        storage::auth_owner_or_admin(e, &caller, token_id);
        storage::extend_instance(e);

        if !storage::cancel_recovery(e, token_id) {
            panic_with_error!(e, errors::MembershipError::NoRecovery)
        }
    }

    fn finalize_recovery(e: &Env, token_id: u32) {
        let request = Self::recovery(e, token_id)
            .unwrap_or_else(|| panic_with_error!(e, errors::MembershipError::NoRecovery));
        // the admin can approve before the delay elapsed
        if e.ledger().timestamp() < request.executable_at {
            Self::admin(e).require_auth();
        }
        storage::extend_instance(e);

        // a recovery carries the authority of the attester that proposed
        // it, and nothing beyond its window
        if request.attester != Self::attester(e) {
            panic_with_error!(e, errors::MembershipError::AttesterChanged)
        }
        if e.ledger().timestamp() >= request.executable_at + types::RECOVERY_DELAY {
            panic_with_error!(e, errors::MembershipError::RecoveryExpired)
        }

        let from = Self::owner_of(e, token_id);
        // no event: Recovered supersedes the cancellation
        e.storage()
            .persistent()
            .remove(&types::MemberKey::Recovery(token_id));
        storage::set_owner(e, token_id, Some(from.clone()), &request.new_address);
        Self::extend_member(e, token_id);

        events::Recovered {
            token_id,
            from,
            to: request.new_address,
        }
        .publish(e);
    }

    fn recover(e: &Env, token_id: u32, new_address: Address) {
        Self::admin(e).require_auth();
        storage::extend_instance(e);

        let mut member = Self::member(e, token_id);
        let from: Option<Address> = e
            .storage()
            .persistent()
            .get(&types::MemberKey::Owner(token_id));

        storage::cancel_recovery(e, token_id);
        storage::set_owner(e, token_id, from.clone(), &new_address);
        member.status = types::Status::Active;
        storage::save_member(e, token_id, &member);

        events::AdminRecovered {
            token_id,
            from,
            to: new_address,
        }
        .publish(e);
    }

    fn recovery(e: &Env, token_id: u32) -> Option<types::RecoveryRequest> {
        e.storage()
            .persistent()
            .get(&types::MemberKey::Recovery(token_id))
    }
}
