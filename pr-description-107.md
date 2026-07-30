# Add indexer test coverage for decoder, scval, sac, sep41Metadata, validateSep41, db, auth

## Summary

Fixes the gap reported in issue #107: `indexer/test/` previously contained only
`xdr_decoder.test.js`. This PR adds seven new test files — one for every module
listed in the issue — and brings total test coverage from 5 tests to **115 tests
across 29 suites, all passing**.

Two latent source bugs discovered during test authoring were also corrected (see
**Bug fixes** below).

---

## What was added

### New test files (`indexer/test/`)

| File | Module under test | Tests |
|------|-------------------|-------|
| `decoder.test.js` | `src/decoder.js` | 10 |
| `scval.test.js` | `src/scval.js` | 38 |
| `sac.test.js` | `src/sac.js` | 13 |
| `auth.test.js` | `src/auth.js` | 20 |
| `sep41Metadata.test.js` | `src/sep41Metadata.js` | 6 |
| `validateSep41.test.js` | `src/validateSep41.js` | 8 |
| `db.test.js` | `src/db.js` | 20 |

Total new tests: **115** (including the pre-existing 5 in `xdr_decoder.test.js`).

---

## Test design decisions

### decoder.test.js
- Imports the live `db` export and replaces `db.getContractMeta` with an
  in-test stub before any `decode()` call. This avoids any database dependency.
- Each test uses a **unique contract ID** (derived from `StrKey.encodeContract(Buffer.alloc(32, i))`)
  to prevent the internal 60-second LRU cache in `decoder.js` from leaking
  state between tests.
- Tests cover: all four named `buildDescription` branches (`swap`, `transfer`,
  `mint`, `burn`), the `genericDescription` fallback, SAC label injection,
  `event_addresses` extraction, and the `unknown` function name fallback.

### scval.test.js
- Builds all `ScVal` XDR types directly using `@stellar/stellar-sdk`'s `xdr`
  module so tests are self-contained and do not require any network.
- Dedicated BigInt section covers `scvU64`, `scvI64`, `scvU128`, `scvI128`,
  `scvU256`, `scvI256`, `scvTimepoint`, `scvDuration` — including the
  `u64 > Number.MAX_SAFE_INTEGER` boundary that would silently lose precision
  with a naïve `Number()` cast.
- Uses a **deterministic keypair** (`Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1))`)
  for address encoding tests so the expected strkey is stable.

### sac.test.js
- Verifies `detectSac` with the **real** XLM SAC contract ID computed via
  `Asset.native().contractId(Networks.TESTNET)` — the same derivation the
  module uses — confirming the determinism of that computation.
- Asserts the two-key shape of the return object and that `sacLabel` prefers
  the asset code over the raw contract ID for SAC contracts.

### auth.test.js
- Uses two **pre-generated base64 XDR `TransactionEnvelope` fixtures** built
  offline with the Stellar SDK:
  1. `sorobanCredentialsSourceAccount` (no signer/nonce) — `transfer` invocation.
  2. `sorobanCredentialsAddress` with nonce `42n` and a real signer G-address —
     `mint` invocation.
- Confirms the returned `{ signer, nonce, rootInvocation }` shape for both
  credential types, including that `signer` is `null` for source-account creds.

### sep41Metadata.test.js
- Stubs `SorobanRpc.Server.prototype.simulateTransaction` **before** the module
  is imported, so the module-level `rpc` singleton uses the stub.
- Sets `process.env.OPERATIONAL_ACCOUNT` to a valid G-address before import to
  satisfy the `new Account(DUMMY_SOURCE, seq)` call that runs before the stub
  intercepts.
- Tests return value shape, `void` coercion defaults, and cache behaviour (a
  second call to the same contract ID fires no further simulate calls).

### validateSep41.test.js
- Same stub strategy as `sep41Metadata.test.js`.
- Covers all four compliance scenarios: all-present, all-absent, all-execution-
  error (treated as present), and mixed presence.
- Asserts that `results` always has exactly 10 entries with boolean values.

### db.test.js
- Patches `pg.Pool.prototype.query` and `pg.Pool.prototype.connect` **before**
  the module is imported, replacing them with an in-memory recorder that stores
  `{ sql, params }` tuples.
- Every test group uses `beforeEach(() => resetMock())` to clear call history
  and per-call overrides, making tests fully independent.
- Covers `ping`, `upsertEvent` (INSERT + ON CONFLICT), `getEvent`, `getEvents`
  (pagination + filter), `getContractMeta`, `upsertContractMeta`,
  `getCursor`/`setCursor`, `getWalletEvents`, and `get24hVolume` (integer
  scaling via BigInt).

---

## Bug fixes

### `src/validateSep41.js` — invalid `DUMMY_SOURCE` address
The hardcoded constant

```js
const DUMMY_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
```

fails checksum validation in `@stellar/stellar-base` `Address.fromString()`,
which is called at module load time when building `DUMMY_ADDR`. The process
crashes immediately when `validateSep41.js` is imported.

**Fix:** replaced with the valid deterministic address
`GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR`
(derived from `Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1))`).

### `src/sep41Metadata.js` — invalid default `DUMMY_SOURCE` address
The same invalid address was used as the fallback in:

```js
process.env.OPERATIONAL_ACCOUNT || "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
```

`new Account(DUMMY_SOURCE, sequence)` rejects it with `accountId is invalid`,
crashing every call to `fetchTokenMetadata` when `OPERATIONAL_ACCOUNT` is not
set in the environment.

**Fix:** same replacement address as above.

---

## Test run output

```
ℹ tests 115
ℹ suites 29
ℹ pass  115
ℹ fail    0
ℹ duration_ms 2437
```

Run locally with:

```bash
cd indexer
npm install
node --test test/**/*.test.js
```

---

closes #107
