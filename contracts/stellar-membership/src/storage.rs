//! Storage access, validation and invariants shared by all entry points.
//!
//! Invariants:
//! - `Owner(t) = a` iff `TokenOf(a) = t`.
//! - `Owner(t)` exists iff `Member(t).status == Active`.
//! - `Account(p, id) = t` iff `Member(t)` holds that account.
//! - `Recovery(t)` only exists for active tokens.

use soroban_sdk::{Address, Env, IntoVal, String, Val, Vec, panic_with_error};

use crate::errors::MembershipError;
use crate::events;
use crate::types::{
    DataKey, ExternalAccounts, MAX_ACCOUNT_LEN, MAX_BIO_LEN, MAX_PROJECT_LEN, MAX_PROJECTS, Member,
    MemberKey, Provider, RecoveryRequest, TTL_EXTEND_TO, TTL_THRESHOLD,
};

pub fn extend_instance(e: &Env) {
    e.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn write<K, V>(e: &Env, key: &K, val: &V)
where
    K: IntoVal<Env, Val>,
    V: IntoVal<Env, Val>,
{
    e.storage().persistent().set(key, val);
    e.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn extend<K: IntoVal<Env, Val>>(e: &Env, key: &K) {
    e.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn admin(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn attester(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::Attester).unwrap()
}

pub fn member(e: &Env, token_id: u32) -> Member {
    e.storage()
        .persistent()
        .get(&MemberKey::Member(token_id))
        .unwrap_or_else(|| panic_with_error!(e, MembershipError::NonExistentToken))
}

/// Current address of an active token.
pub fn owner(e: &Env, token_id: u32) -> Address {
    match current_owner(e, token_id) {
        Some(owner) => owner,
        None if e.storage().persistent().has(&MemberKey::Member(token_id)) => {
            panic_with_error!(e, MembershipError::TokenRevoked)
        }
        None => panic_with_error!(e, MembershipError::NonExistentToken),
    }
}

pub fn token_of(e: &Env, address: &Address) -> Option<u32> {
    e.storage()
        .persistent()
        .get(&MemberKey::TokenOf(address.clone()))
}

/// Require the auth of `caller` and that it is the token owner or the admin.
pub fn auth_owner_or_admin(e: &Env, caller: &Address, token_id: u32) {
    caller.require_auth();
    if *caller != owner(e, token_id) && *caller != admin(e) {
        panic_with_error!(e, MembershipError::UnauthorizedSigner)
    }
}

/// Address of a token, `None` when revoked.
pub fn current_owner(e: &Env, token_id: u32) -> Option<Address> {
    e.storage().persistent().get(&MemberKey::Owner(token_id))
}

/// Panics unless the token exists and is active.
pub fn require_active(e: &Env, token_id: u32) {
    owner(e, token_id);
}

pub fn token_by_account(e: &Env, provider: Provider, id: String) -> Option<u32> {
    e.storage()
        .persistent()
        .get(&MemberKey::Account(provider, id))
}

/// Store the member and extend the TTL of every entry bound to it.
pub fn save_member(e: &Env, token_id: u32, member: &Member) {
    write(e, &MemberKey::Member(token_id), member);
    extend_links(e, token_id, member);
}

/// Extend the TTL of a member and of every entry bound to it.
pub fn extend_member(e: &Env, token_id: u32) {
    extend(e, &MemberKey::Member(token_id));
    extend_links(e, token_id, &member(e, token_id));
}

fn extend_links(e: &Env, token_id: u32, member: &Member) {
    if let Some(owner) = current_owner(e, token_id) {
        extend(e, &MemberKey::Owner(token_id));
        extend(e, &MemberKey::TokenOf(owner));
    }
    for account in member.external_accounts.accounts.iter() {
        extend(e, &MemberKey::Account(account.provider, account.id));
    }
}

/// Assign `token_id` to `to`, releasing the previous address if any.
pub fn set_owner(e: &Env, token_id: u32, from: Option<Address>, to: &Address) {
    if token_of(e, to).is_some() {
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

pub fn recovery(e: &Env, token_id: u32) -> Option<RecoveryRequest> {
    e.storage().persistent().get(&MemberKey::Recovery(token_id))
}

pub fn write_recovery(e: &Env, token_id: u32, request: &RecoveryRequest) {
    write(e, &MemberKey::Recovery(token_id), request);
}

/// Drop a pending recovery without an event: `Recovered` supersedes it.
pub fn clear_recovery(e: &Env, token_id: u32) {
    e.storage()
        .persistent()
        .remove(&MemberKey::Recovery(token_id));
}

/// Drop a pending recovery and publish its cancellation. Returns whether
/// there was one.
pub fn cancel_recovery(e: &Env, token_id: u32) -> bool {
    let pending = recovery(e, token_id).is_some();
    if pending {
        clear_recovery(e, token_id);
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

fn check_max_len(e: &Env, value: &String, max: u32) {
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

pub fn validate_bio(e: &Env, bio: &String) {
    check_max_len(e, bio, MAX_BIO_LEN);
}

pub fn validate_projects(e: &Env, projects: &Vec<String>) {
    if projects.len() > MAX_PROJECTS {
        panic_with_error!(e, MembershipError::TooManyProjects)
    }
    for project in projects.iter() {
        check_non_empty(e, &project, MAX_PROJECT_LEN);
    }
}
