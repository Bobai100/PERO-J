#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Bytes, BytesN, Env, Map, String, Symbol, Vec,
    log, panic_with_error,
};

// ── Error codes ──────────────────────────────────────────────────────────────
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotFound      = 1,
    Unauthorized  = 2,
    AlreadyExists = 3,
}

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
        let key = DataKey::Contract(contract_id.clone());
        let existing: ContractMeta = env.storage().persistent()
            .get(&key).unwrap_or_else(|| panic_with_error!(&env, Error::NotFound));

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != existing.registered_by && caller != admin {
            panic_with_error!(&env, Error::Unauthorized);
        }
        env.storage().persistent().set(&key, &meta);

        // Warn when the ABI is intentionally or accidentally wiped so the
        // indexer can log a human-readable warning instead of silently falling
        // back to generic descriptions.
        if meta.functions.is_empty() {
            env.events().publish(
                (symbol_short!("abi_cleared"), contract_id),
                (),
            );
        }
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
        // Only admin or registered indexers may submit events.
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic_with_error!(&env, Error::Unauthorized);
        }

        let seq: u64 = env.storage().instance().get(&DataKey::EventSeq).unwrap_or(0);
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
    pub fn event_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::EventSeq).unwrap_or(0)
    }

    /// Fetch a page of events [from, from+limit).
    pub fn get_events(env: Env, from: u64, limit: u32) -> Vec<DecodedEvent> {
        let total: u64 = env.storage().instance().get(&DataKey::EventSeq).unwrap_or(0);
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
    #[should_panic]
    fn test_transfer_admin_wrong_caller_panics() {
        let (env, client) = setup();
        let admin    = Address::generate(&env);
        let attacker = Address::generate(&env);
        client.init(&admin);
        // attacker tries to hijack admin — must panic
        client.transfer_admin(&attacker, &attacker);
    }

    // ── get_events pagination boundary tests (issue #15) ─────────────────────

    /// Helper: initialise the contract, submit `n` dummy events, and return the
    /// client together with the admin address.
    fn setup_with_events(n: u32) -> (Env, ExplorerContractClient<'static>, Address) {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.init(&admin);

        let cid: BytesN<32> = BytesN::from_array(&env, &[9u8; 32]);
        for i in 0..n {
            client.submit_event(
                &admin,
                &cid,
                &symbol_short!("ev"),
                &(1000u32 + i),
                &String::from_str(&env, "test event"),
                &Vec::new(&env),
                &Bytes::new(&env),
            );
        }
        (env, client, admin)
    }

    /// from=0, limit=0 → empty vec (no events returned regardless of total).
    #[test]
    fn test_get_events_limit_zero_returns_empty() {
        let (_env, client, _admin) = setup_with_events(5);
        let result = client.get_events(&0u64, &0u32);
        assert_eq!(result.len(), 0u32);
    }

    /// from=total, limit=10 → empty vec (cursor is already past the end).
    #[test]
    fn test_get_events_from_equals_total_returns_empty() {
        let (_env, client, _admin) = setup_with_events(5);
        let total = client.event_count(); // 5
        let result = client.get_events(&total, &10u32);
        assert_eq!(result.len(), 0u32);
    }

    /// from=total-1, limit=100 → exactly 1 event (only the last event).
    #[test]
    fn test_get_events_from_last_returns_one() {
        let (_env, client, _admin) = setup_with_events(5);
        let total = client.event_count(); // 5
        let result = client.get_events(&(total - 1), &100u32);
        assert_eq!(result.len(), 1u32);
    }
}
