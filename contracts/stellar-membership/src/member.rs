use crate::{
    CoreTrait, MemberTrait, StellarMembership, StellarMembershipArgs, StellarMembershipClient,
    TokenTrait, errors, events, storage, types,
};
use soroban_sdk::{Address, Env, String, Vec, contractimpl, panic_with_error};

#[contractimpl]
impl MemberTrait for StellarMembership {
    fn member(e: &Env, token_id: u32) -> types::Member {
        e.storage()
            .persistent()
            .get(&types::MemberKey::Member(token_id))
            .unwrap_or_else(|| panic_with_error!(e, errors::MembershipError::NonExistentToken))
    }

    fn token_by_account(e: &Env, provider: types::Provider, id: String) -> Option<u32> {
        e.storage()
            .persistent()
            .get(&types::MemberKey::Account(provider, id))
    }

    fn extend_member(e: &Env, token_id: u32) {
        // read first: a missing token has to fail as NonExistentToken, not
        // as an untyped host error out of extend_ttl
        let member = Self::member(e, token_id);
        e.storage().persistent().extend_ttl(
            &types::MemberKey::Member(token_id),
            types::PERSISTENT_TTL_THRESHOLD,
            types::PERSISTENT_TTL_EXTEND_TO,
        );
        storage::extend_links(e, token_id, &member);
    }

    fn set_role(e: &Env, token_id: u32, role: types::Role) {
        Self::admin(e).require_auth();
        storage::extend_instance(e);
        // panics unless the token exists and is active
        Self::owner_of(e, token_id);

        let mut member = Self::member(e, token_id);
        member.role = role;
        storage::save_member(e, token_id, &member);

        events::RoleSet { token_id, role }.publish(e);
    }

    fn set_external_accounts(e: &Env, token_id: u32, external_accounts: types::ExternalAccounts) {
        Self::owner_of(e, token_id).require_auth();
        Self::attester(e).require_auth();
        storage::extend_instance(e);

        storage::validate_accounts(e, &external_accounts);

        let mut member = Self::member(e, token_id);
        storage::unbind_accounts(e, &member.external_accounts);
        storage::bind_accounts(e, token_id, &external_accounts);
        member.external_accounts = external_accounts.clone();
        storage::save_member(e, token_id, &member);

        events::ExternalAccountsSet {
            token_id,
            external_accounts,
        }
        .publish(e);
    }

    fn set_bio(e: &Env, caller: Address, token_id: u32, bio: String) {
        storage::auth_owner_or_admin(e, &caller, token_id);
        storage::extend_instance(e);
        storage::check_max_len(e, &bio, types::MAX_BIO_LEN);

        let mut member = Self::member(e, token_id);
        member.bio = bio.clone();
        storage::save_member(e, token_id, &member);

        events::BioSet { token_id, bio }.publish(e);
    }

    fn set_projects(e: &Env, caller: Address, token_id: u32, projects: Vec<String>) {
        storage::auth_owner_or_admin(e, &caller, token_id);
        storage::extend_instance(e);
        storage::validate_projects(e, &projects);

        let mut member = Self::member(e, token_id);
        member.projects = projects.clone();
        storage::save_member(e, token_id, &member);

        events::ProjectsSet { token_id, projects }.publish(e);
    }
}
