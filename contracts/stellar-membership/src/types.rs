use soroban_sdk::{Address, BytesN, String, Vec, contracttype};

/// Maximum number of projects a member can declare.
pub const MAX_PROJECTS: u32 = 10;
/// Maximum length of a project identifier, e.g. `daoip-5:scf:project:pg_atlas`.
pub const MAX_PROJECT_LEN: u32 = 128;
/// Maximum length of the bio IPFS CID.
pub const MAX_BIO_LEN: u32 = 128;
/// Maximum length of an external account id or handle.
pub const MAX_ACCOUNT_LEN: u32 = 64;

/// Delay before an attested recovery can be finalized, and the window it
/// then has to be finalized in (7 days each).
pub const RECOVERY_DELAY: u64 = 7 * 24 * 3600;

// Ledger counts, not durations. A ledger closes in about five seconds
// today and that is not a promise: none of the values below may be read as
// a time, and no business logic depends on them.
const DAY_IN_LEDGERS: u32 = 17_280;

/// A persistent entry below this many ledgers is extended when written.
pub const PERSISTENT_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
/// Life given to a persistent entry when it is written or extended.
pub const PERSISTENT_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
/// The instance holds the contract settings and is read by every call.
pub const INSTANCE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const INSTANCE_TTL_EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
/// The code entry is the largest the contract owns and is extended apart
/// from the instance to smooth the cost: the caller that happens to cross
/// the threshold pays 30 days of rent on it rather than 90. Rent per unit
/// of time is the same either way; what the shorter target gives up is the
/// longest the contract can sit idle, since an archived code entry is what
/// makes it uninvocable. The guaranteed margin is the threshold, 30 days,
/// whatever the target.
pub const CODE_TTL_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
pub const CODE_TTL_EXTEND_TO: u32 = 60 * DAY_IN_LEDGERS;

#[contracttype]
pub enum DataKey {
    Admin,
    Attester,
    NextTokenId,
    Name,
    Symbol,
    Uri,
    UriTrait,
    NqgContract,
}

#[contracttype]
pub enum MemberKey {
    /// token_id -> current address. Absent when revoked.
    Owner(u32),
    /// address -> token_id. Absent when the address is not a member.
    TokenOf(Address),
    /// token_id -> Member.
    Member(u32),
    /// (provider, account id) -> token_id.
    Account(Provider, String),
    /// token_id -> pending RecoveryRequest.
    Recovery(u32),
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    Verified = 0,
    Pathfinder = 1,
    Navigator = 2,
    Pilot = 3,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Status {
    Active = 0,
    Revoked = 1,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Provider {
    Discord = 0,
    Github = 1,
    X = 2,
}

/// An account on an external platform verified by the attester.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SocialAccount {
    pub provider: Provider,
    /// Stable identifier on the platform (e.g. Discord snowflake).
    pub id: String,
    /// Display handle at the time of verification.
    pub handle: String,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExternalAccounts {
    /// At most one account per provider.
    pub accounts: Vec<SocialAccount>,
    /// sha256 of the trimmed, lowercased email, as verified by the
    /// attester. Not unique across members: it links a member to its
    /// contributions in PG Atlas, it does not identify one.
    pub email_hash: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Member {
    pub status: Status,
    pub role: Role,
    pub external_accounts: ExternalAccounts,
    /// IPFS CID of the profile directory.
    pub bio: String,
    /// DAOIP-5 project identifiers.
    pub projects: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryRequest {
    /// The attester that proposed it. A recovery is only as good as the
    /// attester behind it, so replacing the attester voids it.
    pub attester: Address,
    pub new_address: Address,
    pub executable_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Governance {
    pub role: Role,
    pub nqg: i128,
}
