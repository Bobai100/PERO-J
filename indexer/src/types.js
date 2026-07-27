/**
 * @file types.js
 * Shared JSDoc @typedef definitions for the indexer.
 *
 * This file contains no runtime code — it exists solely as the single source
 * of truth for types that cross module boundaries. Import it in any file that
 * needs the type annotations:
 *
 *   // eslint-disable-next-line no-unused-vars
 *   import {} from './types.js';  // side-effect-free; gives editor type info
 *
 * Or, for files that only need one type, use an inline @typedef import:
 *
 *   /** @typedef {import('./types.js').DecodedEvent} DecodedEvent *\/
 */

// ─── Contract metadata ────────────────────────────────────────────────────────

/**
 * A single function entry in a contract's ABI-like metadata.
 *
 * @typedef {object} FunctionAbi
 * @property {string}   name        - Function name as it appears in contract events (e.g. "swap").
 * @property {string[]} [inputs]    - Human-readable parameter names/descriptions.
 * @property {string}   [description] - Free-text description of what the function does.
 */

/**
 * ABI-like metadata for a registered Soroban contract.
 * Produced by db.getContractMeta() and consumed by decoder.js.
 *
 * @typedef {object} ContractMeta
 * @property {string}        id            - Strkey-encoded contract address (C…).
 * @property {string}        name          - Human-readable contract name (e.g. "StellarSwap").
 * @property {string}        [description] - Optional free-text contract description.
 * @property {FunctionAbi[]} [functions]   - Registered function signatures.
 * @property {string}        [registered_by] - Stellar address that registered this contract.
 * @property {string}        [created_at]  - ISO 8601 timestamp from the database.
 */

// ─── Decoded event ────────────────────────────────────────────────────────────

/**
 * A fully decoded Soroban contract event ready to be written to the database.
 *
 * Produced by decoder.decode() and consumed by db.upsertEvent().
 * Every field maps directly to a column in the `events` table.
 *
 * @typedef {object} DecodedEvent
 * @property {string}      contract_id  - Strkey-encoded contract address that emitted the event.
 * @property {string}      function     - Function / event name (first topic, e.g. "swap").
 * @property {number}      ledger       - Stellar ledger sequence number.
 * @property {string|null} tx_hash      - Transaction hash, or null when unavailable.
 * @property {string}      description  - Human-readable sentence describing the event.
 * @property {string[]}    raw_topics   - All decoded topics serialised to strings.
 * @property {string}      raw_data     - JSON.stringify of the decoded event data ScVal.
 * @property {string}      [sac_asset]  - Classic asset code (e.g. "USDC") when the contract
 *                                        is a Stellar Asset Contract (SAC). Omitted otherwise.
 */

// ─── Health state ─────────────────────────────────────────────────────────────

/**
 * Live indexer health state shared between index.js (writer) and api.js (reader).
 *
 * @typedef {object} HealthState
 * @property {number|null} lastIndexedAt - Unix timestamp (ms) of last successfully indexed
 *                                         ledger batch, or null before the first batch.
 * @property {number|null} lastLedger    - Most-recently processed ledger sequence number,
 *                                         or null before the first batch.
 * @property {number}      startedAt     - Unix timestamp (ms) when the process started.
 *                                         Used for uptime calculation.
 */

// ─── Volume result ────────────────────────────────────────────────────────────

/**
 * 24-hour rolling transfer volume for a contract.
 * Returned by db.get24hVolume().
 *
 * @typedef {object} VolumeResult
 * @property {string} volume_raw    - Raw sum as a decimal string (before scaling by decimals).
 * @property {string} volume_scaled - Human-readable amount with correct decimal places.
 * @property {number} decimals      - Decimal precision used for scaling (default 7).
 */

// This file is intentionally empty at runtime.
export {};
