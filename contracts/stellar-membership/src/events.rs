//! Every change to a member is published with `token_id` as topic and
//! carries the new value, so that the state can be rebuilt from events.

use soroban_sdk::{Address, String, Vec, contractevent};

use crate::types::{ExternalAccounts, Role};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Minted {
    #[topic]
    pub token_id: u32,
    #[topic]
    pub to: Address,
    pub role: Role,
    pub external_accounts: ExternalAccounts,
    pub bio: String,
    pub projects: Vec<String>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Revoked {
    #[topic]
    pub token_id: u32,
    pub from: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeyRotated {
    #[topic]
    pub token_id: u32,
    pub from: Address,
    pub to: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryProposed {
    #[topic]
    pub token_id: u32,
    pub new_address: Address,
    pub executable_at: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryCancelled {
    #[topic]
    pub token_id: u32,
}

/// A recovery the attester proposed, finalized after its delay.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recovered {
    #[topic]
    pub token_id: u32,
    pub from: Address,
    pub to: Address,
}

/// The admin moving a token on its own signature, `recover`. Kept apart
/// from `Recovered` so that a move the member never asked for is never
/// read as one it did.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminRecovered {
    #[topic]
    pub token_id: u32,
    /// `None` when reinstating a revoked token.
    pub from: Option<Address>,
    pub to: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoleSet {
    #[topic]
    pub token_id: u32,
    pub role: Role,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExternalAccountsSet {
    #[topic]
    pub token_id: u32,
    pub external_accounts: ExternalAccounts,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BioSet {
    #[topic]
    pub token_id: u32,
    pub bio: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProjectsSet {
    #[topic]
    pub token_id: u32,
    pub projects: Vec<String>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminSet {
    pub previous_admin: Address,
    pub admin: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttesterSet {
    pub previous_attester: Address,
    pub attester: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NqgContractSet {
    pub previous_nqg_contract: Address,
    pub nqg_contract: Address,
}
