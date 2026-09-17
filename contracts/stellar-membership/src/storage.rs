//! Storage invariants and validation shared by all entry points.
//!
//! Reads live on the entry point that exposes them; what is here writes
//! and carries entries forward, and every write keeps these four true:
//! - `Owner(t) = a` iff `TokenOf(a) = t`.
//! - `Owner(t)` exists iff `Member(t).status == Active`.
//! - `Account(p, id) = t` iff `Member(t)` holds that account.
//! - `Recovery(t)` only exists for active tokens.

use soroban_sdk::{Address, Env, IntoVal, String, Val, Vec, panic_with_error};

use crate::errors::MembershipError;
use crate::types::{
    CODE_TTL_EXTEND_TO, CODE_TTL_THRESHOLD, ExternalAccounts, INSTANCE_TTL_EXTEND_TO,
    INSTANCE_TTL_THRESHOLD, MAX_ACCOUNT_LEN, MAX_PROJECT_LEN, MAX_PROJECTS, Member, MemberKey,
    PERSISTENT_TTL_EXTEND_TO, PERSISTENT_TTL_THRESHOLD,
};
use crate::{CoreTrait, KeyTrait, StellarMembership, TokenTrait, events};

/// Extend the instance and the code entries.
///
/// They are extended apart: carrying the code costs more than carrying the
/// instance, so it is given its own, shorter target.
pub fn extend_instance(e: &Env) {
    let contract = e.current_contract_address();
    e.deployer().extend_ttl_for_contract_instance(
        contract.clone(),
        INSTANCE_TTL_THRESHOLD,
        INSTANCE_TTL_EXTEND_TO,
    );
    e.deployer()
        .extend_ttl_for_code(contract, CODE_TTL_THRESHOLD, CODE_TTL_EXTEND_TO);
}

/// Write a persistent entry and carry it forward.
///
/// Creating an entry is what gives it a TTL; rewriting one leaves the TTL
/// it already had, decaying. Without the extension a member written at
/// mint would have to be restored 120 days later however often the profile
/// was edited since.
pub fn write<K, V>(e: &Env, key: &K, val: &V)
where
    K: IntoVal<Env, Val>,
    V: IntoVal<Env, Val>,
{
    let persistent = e.storage().persistent();
    persistent.set(key, val);
    persistent.extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

/// Require the auth of `caller` and that it is the token owner or the admin.
pub fn auth_owner_or_admin(e: &Env, caller: &Address, token_id: u32) {
    caller.require_auth();
    if *caller != StellarMembership::owner_of(e, token_id) && *caller != StellarMembership::admin(e)
    {
        panic_with_error!(e, MembershipError::UnauthorizedSigner)
    }
}

/// Store the member and extend the TTL of every entry bound to it.
pub fn save_member(e: &Env, token_id: u32, member: &Member) {
    write(e, &MemberKey::Member(token_id), member);
    extend_links(e, token_id, member);
}

/// Extend the TTL of every entry bound to a member: its address both ways
/// and the external accounts it reserves.
pub fn extend_links(e: &Env, token_id: u32, member: &Member) {
    let persistent = e.storage().persistent();
    let owner: Option<Address> = persistent.get(&MemberKey::Owner(token_id));
    if let Some(owner) = owner {
        for key in [MemberKey::Owner(token_id), MemberKey::TokenOf(owner)] {
            persistent.extend_ttl(&key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
        }
    }
    for account in member.external_accounts.accounts.iter() {
        persistent.extend_ttl(
            &MemberKey::Account(account.provider, account.id),
            PERSISTENT_TTL_THRESHOLD,
            PERSISTENT_TTL_EXTEND_TO,
        );
    }
}

/// Assign `token_id` to `to`, releasing the previous address if any.
pub fn set_owner(e: &Env, token_id: u32, from: Option<Address>, to: &Address) {
    if e.storage()
        .persistent()
        .has(&MemberKey::TokenOf(to.clone()))
    {
        panic_with_error!(e, MembershipError::MemberAlreadyExist)
    }
    if let Some(from) = from {
        e.storage().persistent().remove(&MemberKey::TokenOf(from));
    }
    write(e, &MemberKey::Owner(token_id), to);
    write(e, &MemberKey::TokenOf(to.clone()), &token_id);
}

pub fn remove_owner(e: &Env, token_id: u32, from: &Address) {
    e.storage().persistent().remove(&MemberKey::Owner(token_id));
    e.storage()
        .persistent()
        .remove(&MemberKey::TokenOf(from.clone()));
}

/// Drop a pending recovery and publish its cancellation. Returns whether
/// there was one.
pub fn cancel_recovery(e: &Env, token_id: u32) -> bool {
    let pending = StellarMembership::recovery(e, token_id).is_some();
    if pending {
        e.storage()
            .persistent()
            .remove(&MemberKey::Recovery(token_id));
        events::RecoveryCancelled { token_id }.publish(e);
    }
    pending
}

pub fn bind_accounts(e: &Env, token_id: u32, external_accounts: &ExternalAccounts) {
    for account in external_accounts.accounts.iter() {
        let key = MemberKey::Account(account.provider, account.id);
        if e.storage().persistent().has(&key) {
            panic_with_error!(e, MembershipError::AccountAlreadyBound)
        }
        write(e, &key, &token_id);
    }
}

pub fn unbind_accounts(e: &Env, external_accounts: &ExternalAccounts) {
    for account in external_accounts.accounts.iter() {
        e.storage()
            .persistent()
            .remove(&MemberKey::Account(account.provider, account.id));
    }
}

pub fn check_max_len(e: &Env, value: &String, max: u32) {
    if value.len() > max {
        panic_with_error!(e, MembershipError::InvalidLength)
    }
}

fn check_non_empty(e: &Env, value: &String, max: u32) {
    if value.is_empty() {
        panic_with_error!(e, MembershipError::InvalidLength)
    }
    check_max_len(e, value, max);
}

pub fn validate_accounts(e: &Env, external_accounts: &ExternalAccounts) {
    let accounts = &external_accounts.accounts;
    for (i, account) in accounts.iter().enumerate() {
        check_non_empty(e, &account.id, MAX_ACCOUNT_LEN);
        check_max_len(e, &account.handle, MAX_ACCOUNT_LEN);
        if accounts
            .iter()
            .skip(i + 1)
            .any(|other| other.provider == account.provider)
        {
            panic_with_error!(e, MembershipError::DuplicateProvider)
        }
    }
}

pub fn validate_projects(e: &Env, projects: &Vec<String>) {
    if projects.len() > MAX_PROJECTS {
        panic_with_error!(e, MembershipError::TooManyProjects)
    }
    for project in projects.iter() {
        check_non_empty(e, &project, MAX_PROJECT_LEN);
    }
}
