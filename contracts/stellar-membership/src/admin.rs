use crate::{
    CoreTrait, StellarMembership, StellarMembershipArgs, StellarMembershipClient, events, storage,
    types,
};
use soroban_sdk::{Address, BytesN, ContractExecutable, Env, String, contractimpl};

/// The instance entries below are written by the constructor, so reading one
/// back can only fail on a contract that was never constructed.
pub(crate) const ALWAYS_SET: &str = "written by the constructor";

#[contractimpl]
impl CoreTrait for StellarMembership {
    #[allow(clippy::too_many_arguments)]
    fn __constructor(
        e: &Env,
        admin: Address,
        attester: Address,
        name: String,
        symbol: String,
        uri: String,
        uri_trait: String,
        nqg_contract: Address,
    ) {
        let instance = e.storage().instance();
        instance.set(&types::DataKey::Admin, &admin);
        instance.set(&types::DataKey::Attester, &attester);
        instance.set(&types::DataKey::Name, &name);
        instance.set(&types::DataKey::Symbol, &symbol);
        instance.set(&types::DataKey::Uri, &uri);
        instance.set(&types::DataKey::UriTrait, &uri_trait);
        instance.set(&types::DataKey::NqgContract, &nqg_contract);
        instance.set(&types::DataKey::NextTokenId, &0u32);
        storage::extend_instance(e);
    }

    fn upgrade(e: &Env, wasm_hash: BytesN<32>) {
        Self::admin(e).require_auth();

        e.deployer()
            .update_current_contract(ContractExecutable::Wasm(wasm_hash));
        // after the swap, so the entry extended is the one just installed
        storage::extend_instance(e);
    }

    fn set_admin(e: &Env, admin: Address) {
        let previous_admin = Self::admin(e);
        previous_admin.require_auth();
        storage::extend_instance(e);

        e.storage().instance().set(&types::DataKey::Admin, &admin);

        events::AdminSet {
            previous_admin,
            admin,
        }
        .publish(e);
    }

    fn set_attester(e: &Env, attester: Address) {
        Self::admin(e).require_auth();
        storage::extend_instance(e);

        let previous_attester = Self::attester(e);
        e.storage()
            .instance()
            .set(&types::DataKey::Attester, &attester);

        events::AttesterSet {
            previous_attester,
            attester,
        }
        .publish(e);
    }

    fn set_nqg_contract(e: &Env, nqg_contract: Address) {
        Self::admin(e).require_auth();
        storage::extend_instance(e);

        let previous_nqg_contract = Self::nqg_contract(e);
        e.storage()
            .instance()
            .set(&types::DataKey::NqgContract, &nqg_contract);

        events::NqgContractSet {
            previous_nqg_contract,
            nqg_contract,
        }
        .publish(e);
    }

    fn admin(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&types::DataKey::Admin)
            .expect(ALWAYS_SET)
    }

    fn attester(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&types::DataKey::Attester)
            .expect(ALWAYS_SET)
    }

    fn nqg_contract(e: &Env) -> Address {
        e.storage()
            .instance()
            .get(&types::DataKey::NqgContract)
            .expect(ALWAYS_SET)
    }
}
