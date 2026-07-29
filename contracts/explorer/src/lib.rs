#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short,
    Address, Bytes, BytesN, Env, Map, String, Symbol, Vec,
    log, panic_with_error,
};

// ── Error codes ──────────────────────────────────────────────────────────────
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound       = 1,
    Unauthorized   = 2,
    AlreadyExists  = 3,
    InvalidInput   = 4,
    NotInitialized = 5,
}

// ── Input limits ─────────────────────────────────────────────────────────────
// Bounds on caller-supplied payloads so a single call cannot bloat on-chain
// storage (and the rent every user pays for it) without limit.

/// Largest `raw_data` blob accepted by `submit_event`.
pub const MAX_RAW_DATA_BYTES: u32 = 4096;
/// Largest number of functions accepted in a `ContractMeta`.
pub const MAX_FUNCTIONS: u32 = 64;
/// Largest number of parameters accepted per function.
pub const MAX_PARAMS: u32 = 32;

// ── Storage keys ─────────────────────────────────────────────────────────────
#[contracttype]
pub enum DataKey {
    Admin,
    Contract(BytesN<32>),   // contract_id → ContractMeta
    EventLog(u64),          // seq → DecodedEvent
    EventSeq,
}

// ── Data types ────────────────────────────────────────────────────────────────

/// ABI-like metadata for a registered contract.
#[contracttype]
#[derive(Clone)]
pub struct ContractMeta {
    pub name:        String,          // e.g. "StellarSwap"
    pub description: String,
    pub functions:   Vec<FunctionAbi>,
    pub registered_by: Address,
}

/// Describes one callable function so the explorer can decode calls.
#[contracttype]
#[derive(Clone)]
pub struct FunctionAbi {
    pub name:        Symbol,          // e.g. symbol_short!("swap")
    pub description: String,          // "Swap token_in for token_out"
    pub params:      Vec<ParamDef>,
}

/// One parameter definition.
#[contracttype]
#[derive(Clone)]
pub struct ParamDef {
    pub name:     Symbol,
    pub kind:     Symbol,   // "address" | "i128" | "symbol" | "bytes"
}

/// A decoded, human-readable event stored on-chain.
#[contracttype]
#[derive(Clone)]
pub struct DecodedEvent {
    pub seq:          u64,
    pub contract_id:  BytesN<32>,
    pub function:     Symbol,
    pub ledger:       u32,
    pub description:  String,   // "Address GA… swapped 100 USDC → 98.7 XLM"
    pub raw_topics:   Vec<String>,
    pub raw_data:     Bytes,
}

// ── Contract ──────────────────────────────────────────────────────────────────
#[contract]
pub struct ExplorerContract;

// ── Internal helpers (not part of the contract interface) ─────────────────────
impl ExplorerContract {
    /// Read the event sequence counter, requiring the contract to be initialised.
    ///
    /// `unwrap_or(0)` would report "0 events" both when no event has been
    /// submitted and when the counter is missing entirely (uninitialised
    /// contract, or instance storage restored without it), so callers could not
    /// tell a real count from a lost one. Panicking makes the discrepancy loud.
    fn event_seq(env: &Env) -> u64 {
        if !env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(env, Error::NotInitialized);
        }
        env.storage().instance()
            .get(&DataKey::EventSeq)
            .unwrap_or_else(|| panic_with_error!(env, Error::NotInitialized))
    }

    /// Reject ABI metadata that would inflate persistent storage without bound.
    fn validate_meta(env: &Env, meta: &ContractMeta) {
        if meta.functions.len() > MAX_FUNCTIONS {
            panic_with_error!(env, Error::InvalidInput);
        }
        for f in meta.functions.iter() {
            if f.params.len() > MAX_PARAMS {
                panic_with_error!(env, Error::InvalidInput);
            }
        }
    }
}

#[contractimpl]
impl ExplorerContract {

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Initialise with an admin address (call once).
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, Error::AlreadyExists);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EventSeq, &0u64);
    }

    /// Return the current admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotInitialized))
    }

    /// Transfer admin rights to a new address.
    ///
    /// Only the current admin may call this.  Both `current_admin` and
    /// `new_admin` must authorise the transaction so that a mis-typed address
    /// cannot accidentally lock the contract.
    ///
    /// Key-management recommendation: keep `new_admin` on a hardware wallet
    /// (Ledger/Trezor) or use a multi-sig account.  See SECURITY.md for the
    /// emergency recovery procedure.
    pub fn transfer_admin(env: Env, current_admin: Address, new_admin: Address) {
        current_admin.require_auth();
        new_admin.require_auth();

        let stored: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        if current_admin != stored {
            panic_with_error!(&env, Error::Unauthorized);
        }

        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events().publish(
            (symbol_short!("adm_xfr"),),
            (current_admin, new_admin),
        );
    }

    // ── Contract Registry ─────────────────────────────────────────────────────

    /// Register ABI-like metadata for a Soroban contract.
    pub fn register_contract(
        env:         Env,
        caller:      Address,
        contract_id: BytesN<32>,
        meta:        ContractMeta,
    ) {
        caller.require_auth();
        Self::validate_meta(&env, &meta);
        let key = DataKey::Contract(contract_id.clone());
        if env.storage().persistent().has(&key) {
            panic_with_error!(&env, Error::AlreadyExists);
        }
        env.storage().persistent().set(&key, &meta);
        env.events().publish(
            (symbol_short!("register"), contract_id),
            meta.name,
        );
    }

    /// Update metadata (admin or original registrant only).
    pub fn update_contract(
        env:         Env,
        caller:      Address,
        contract_id: BytesN<32>,
        meta:        ContractMeta,
    ) {
        caller.require_auth();
        Self::validate_meta(&env, &meta);
        let key = DataKey::Contract(contract_id.clone());
        let existing: ContractMeta = env.storage().persistent()
            .get(&key).unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != existing.registered_by && caller != admin {
            panic_with_error!(&env, Error::Unauthorized);
        }
        env.storage().persistent().set(&key, &meta);
    }

    /// Fetch metadata for a contract.
    pub fn get_contract(env: Env, contract_id: BytesN<32>) -> ContractMeta {
        env.storage().persistent()
            .get(&DataKey::Contract(contract_id))
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound))
    }

    // ── Event Decoder ─────────────────────────────────────────────────────────

    /// Submit a decoded event (called by the off-chain indexer via a trusted tx).
    /// The indexer decodes raw XDR and calls this to persist a human-readable record.
    pub fn submit_event(
        env:         Env,
        caller:      Address,
        contract_id: BytesN<32>,
        function:    Symbol,
        ledger:      u32,
        description: String,
        raw_topics:  Vec<String>,
        raw_data:    Bytes,
    ) {
        caller.require_auth();
        // Reject oversized payloads before touching storage.
        if raw_data.len() > MAX_RAW_DATA_BYTES {
            panic_with_error!(&env, Error::InvalidInput);
        }
        // Only admin or registered indexers may submit events.
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let seq: u64 = Self::event_seq(&env);
        let event = DecodedEvent {
            seq,
            contract_id: contract_id.clone(),
            function: function.clone(),
            ledger,
            description: description.clone(),
            raw_topics,
            raw_data,
        };
        env.storage().persistent().set(&DataKey::EventLog(seq), &event);
        env.storage().instance().set(&DataKey::EventSeq, &(seq + 1));

        env.events().publish(
            (symbol_short!("decoded"), contract_id, function),
            description,
        );
    }

    /// Fetch a single decoded event by sequence number.
    pub fn get_event(env: Env, seq: u64) -> DecodedEvent {
        env.storage().persistent()
            .get(&DataKey::EventLog(seq))
            .unwrap_or_else(|| panic_with_error!(&env, Error::NotFound))
    }

    /// Return the total number of stored events.
    ///
    /// Panics with `NotInitialized` if the counter is absent, rather than
    /// reporting a misleading 0.
    pub fn event_count(env: Env) -> u64 {
        Self::event_seq(&env)
    }

    /// Fetch a page of events [from, from+limit).
    pub fn get_events(env: Env, from: u64, limit: u32) -> Vec<DecodedEvent> {
        let total: u64 = Self::event_seq(&env);
        let mut out: Vec<DecodedEvent> = Vec::new(&env);
        let end = (from + limit as u64).min(total);
        for seq in from..end {
            if let Some(ev) = env.storage().persistent().get(&DataKey::EventLog(seq)) {
                out.push_back(ev);
            }
        }
        out
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, ExplorerContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let id = env.register_contract(None, ExplorerContract);
        let client = ExplorerContractClient::new(&env, &id);
        (env, client)
    }

    #[test]
    fn test_init_and_register() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);
        let meta = ContractMeta {
            name: String::from_str(&env, "StellarSwap"),
            description: String::from_str(&env, "DEX on Stellar"),
            functions: Vec::new(&env),
            registered_by: admin.clone(),
        };
        client.register_contract(&admin, &cid, &meta);
        let fetched = client.get_contract(&cid);
        assert_eq!(fetched.name, String::from_str(&env, "StellarSwap"));
    }

    #[test]
    fn test_submit_and_get_event() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[2u8; 32]);
        client.submit_event(
            &admin,
            &cid,
            &symbol_short!("swap"),
            &4521983u32,
            &String::from_str(&env, "Address GABC... swapped 100 USDC → 98.7 XLM on StellarSwap"),
            &Vec::new(&env),
            &Bytes::new(&env),
        );

        assert_eq!(client.event_count(), 1u64);
        let ev = client.get_event(&0u64);
        assert_eq!(ev.ledger, 4521983u32);
    }

    #[test]
    #[should_panic]
    fn test_double_init_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);
        client.init(&admin); // should panic
    }

    #[test]
    fn test_transfer_admin() {
        let (env, client) = setup();
        let admin     = Address::generate(&env);
        let new_admin = Address::generate(&env);
        client.init(&admin);

        // Transfer admin rights to new_admin
        client.transfer_admin(&admin, &new_admin);

        // new_admin can now submit events; old admin cannot
        let cid: BytesN<32> = BytesN::from_array(&env, &[3u8; 32]);
        client.submit_event(
            &new_admin,
            &cid,
            &symbol_short!("test"),
            &1u32,
            &String::from_str(&env, "test event"),
            &Vec::new(&env),
            &Bytes::new(&env),
        );
        assert_eq!(client.event_count(), 1u64);
    }

    #[test]
    fn test_get_admin() {
        let (env, client) = setup();
        let admin     = Address::generate(&env);
        let new_admin = Address::generate(&env);
        client.init(&admin);
        assert_eq!(client.get_admin(), admin);

        client.transfer_admin(&admin, &new_admin);
        assert_eq!(client.get_admin(), new_admin);
    }

    #[test]
    #[should_panic]
    fn test_get_admin_uninitialised_panics() {
        let (_env, client) = setup();
        client.get_admin();
    }

    #[test]
    #[should_panic]
    fn test_event_count_uninitialised_panics() {
        let (_env, client) = setup();
        client.event_count();
    }

    #[test]
    fn test_submit_event_max_raw_data_ok() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[4u8; 32]);
        let mut raw = Bytes::new(&env);
        for _ in 0..MAX_RAW_DATA_BYTES {
            raw.push_back(0u8);
        }
        client.submit_event(
            &admin, &cid, &symbol_short!("swap"), &1u32,
            &String::from_str(&env, "at the limit"),
            &Vec::new(&env), &raw,
        );
        assert_eq!(client.event_count(), 1u64);
    }

    #[test]
    #[should_panic]
    fn test_submit_event_oversized_raw_data_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[5u8; 32]);
        let mut raw = Bytes::new(&env);
        for _ in 0..(MAX_RAW_DATA_BYTES + 1) {
            raw.push_back(0u8);
        }
        client.submit_event(
            &admin, &cid, &symbol_short!("swap"), &1u32,
            &String::from_str(&env, "one byte too many"),
            &Vec::new(&env), &raw,
        );
    }

    /// Build a `ContractMeta` with `n` functions, each carrying `params` params.
    fn meta_with(env: &Env, admin: &Address, n: u32, params: u32) -> ContractMeta {
        let mut functions: Vec<FunctionAbi> = Vec::new(env);
        for _ in 0..n {
            let mut p: Vec<ParamDef> = Vec::new(env);
            for _ in 0..params {
                p.push_back(ParamDef {
                    name: symbol_short!("amount"),
                    kind: symbol_short!("i128"),
                });
            }
            functions.push_back(FunctionAbi {
                name:        symbol_short!("swap"),
                description: String::from_str(env, "swap"),
                params:      p,
            });
        }
        ContractMeta {
            name:          String::from_str(env, "StellarSwap"),
            description:   String::from_str(env, "DEX on Stellar"),
            functions,
            registered_by: admin.clone(),
        }
    }

    #[test]
    fn test_register_contract_at_abi_limits_ok() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[6u8; 32]);
        let meta = meta_with(&env, &admin, MAX_FUNCTIONS, MAX_PARAMS);
        client.register_contract(&admin, &cid, &meta);
        assert_eq!(client.get_contract(&cid).functions.len(), MAX_FUNCTIONS);
    }

    #[test]
    #[should_panic]
    fn test_register_contract_too_many_functions_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[7u8; 32]);
        let meta = meta_with(&env, &admin, MAX_FUNCTIONS + 1, 0);
        client.register_contract(&admin, &cid, &meta);
    }

    #[test]
    #[should_panic]
    fn test_register_contract_too_many_params_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[8u8; 32]);
        let meta = meta_with(&env, &admin, 1, MAX_PARAMS + 1);
        client.register_contract(&admin, &cid, &meta);
    }

    #[test]
    #[should_panic]
    fn test_update_contract_too_many_functions_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[9u8; 32]);
        client.register_contract(&admin, &cid, &meta_with(&env, &admin, 1, 1));
        client.update_contract(&admin, &cid, &meta_with(&env, &admin, MAX_FUNCTIONS + 1, 0));
    }

    #[test]
    #[should_panic]
    fn test_transfer_admin_wrong_caller_panics() {
        let (env, client) = setup();
        let admin    = Address::generate(&env);
        let attacker = Address::generate(&env);
        client.init(&admin);
        // attacker tries to hijack admin — must panic
        client.transfer_admin(&attacker, &attacker);
    }
}
