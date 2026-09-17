use crate::{
    CoreTrait, MemberTrait, StellarMembership, StellarMembershipArgs, StellarMembershipClient,
    TokenTrait, admin, errors, events, storage, types,
};
use soroban_sdk::{Address, Bytes, Env, IntoVal, String, Val, Vec, contractimpl, panic_with_error};

#[contractimpl]
impl TokenTrait for StellarMembership {
    fn mint(
        e: &Env,
        to: Address,
        role: types::Role,
        external_accounts: types::ExternalAccounts,
        bio: String,
        projects: Vec<String>,
    ) -> u32 {
        to.require_auth();
        let attested: Vec<Val> = (to.clone(), role, external_accounts.clone()).into_val(e);
        Self::attester(e).require_auth_for_args(attested);
        storage::extend_instance(e);

        storage::validate_accounts(e, &external_accounts);
        storage::check_max_len(e, &bio, types::MAX_BIO_LEN);
        storage::validate_projects(e, &projects);

        let token_id = Self::next_token_id(e);
        e.storage()
            .instance()
            .set(&types::DataKey::NextTokenId, &(token_id + 1));

        storage::set_owner(e, token_id, None, &to);
        storage::bind_accounts(e, token_id, &external_accounts);
        storage::save_member(
            e,
            token_id,
            &types::Member {
                status: types::Status::Active,
                role,
                external_accounts: external_accounts.clone(),
                bio: bio.clone(),
                projects: projects.clone(),
            },
        );

        events::Minted {
            token_id,
            to,
            role,
            external_accounts,
            bio,
            projects,
        }
        .publish(e);

        token_id
    }

    fn revoke(e: &Env, token_id: u32) {
        Self::admin(e).require_auth();
        storage::extend_instance(e);

        let from = Self::owner_of(e, token_id);
        let mut member = Self::member(e, token_id);

        storage::cancel_recovery(e, token_id);
        storage::remove_owner(e, token_id, &from);
        member.status = types::Status::Revoked;
        storage::save_member(e, token_id, &member);

        events::Revoked { token_id, from }.publish(e);
    }

    fn balance(e: &Env, owner: Address) -> u32 {
        u32::from(
            e.storage()
                .persistent()
                .has(&types::MemberKey::TokenOf(owner)),
        )
    }

    fn owner_of(e: &Env, token_id: u32) -> Address {
        let owner: Option<Address> = e
            .storage()
            .persistent()
            .get(&types::MemberKey::Owner(token_id));
        match owner {
            Some(owner) => owner,
            None if e
                .storage()
                .persistent()
                .has(&types::MemberKey::Member(token_id)) =>
            {
                panic_with_error!(e, errors::MembershipError::TokenRevoked)
            }
            None => panic_with_error!(e, errors::MembershipError::NonExistentToken),
        }
    }

    fn token_of(e: &Env, owner: Address) -> Option<u32> {
        e.storage()
            .persistent()
            .get(&types::MemberKey::TokenOf(owner))
    }

    fn name(e: &Env) -> String {
        e.storage()
            .instance()
            .get(&types::DataKey::Name)
            .expect(admin::ALWAYS_SET)
    }

    fn symbol(e: &Env) -> String {
        e.storage()
            .instance()
            .get(&types::DataKey::Symbol)
            .expect(admin::ALWAYS_SET)
    }

    fn token_uri(e: &Env, token_id: u32) -> String {
        let base_uri: String = e
            .storage()
            .instance()
            .get(&types::DataKey::Uri)
            .expect(admin::ALWAYS_SET);
        let role = Self::member(e, token_id).role;

        // Construct Uri: {base_uri}/{role}, roles are single digits
        let mut uri_bytes = Bytes::from(base_uri);
        uri_bytes.append(&Bytes::from_slice(e, &[b'/', b'0' + role as u8]));

        String::from(uri_bytes)
    }

    fn next_token_id(e: &Env) -> u32 {
        e.storage()
            .instance()
            .get(&types::DataKey::NextTokenId)
            .expect(admin::ALWAYS_SET)
    }
}
