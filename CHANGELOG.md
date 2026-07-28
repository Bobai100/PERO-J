# Changelog

All notable changes to PERO-J are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Bug Fixes

- Resolve issues [#69](../../issues/69), [#68](../../issues/68), [#67](../../issues/67), and [#66](../../issues/66) simultaneously ([`fbff2bc`](../../commit/fbff2bcd27f3fbe11b8d379348684b4691835407))

1. Issue [#69](../../issues/69) - Add pagination to getWalletEvents & WalletPage:
  - Updated db.getWalletEvents to accept page and limit parameters, query total event count, and fetch paginated results using LIMIT and OFFSET in SQL.
  - Updated GET /api/wallet/:address endpoint to pass query parameters (page and limit) to db.getWalletEvents and return a wrapper object containing { events, total, page, limit }.
  - Updated frontend api.ts and WalletPage.tsx to pass page parameter to api.wallet and render Prev/Next pagination UI controls.

  2. Issue [#68](../../issues/68) - Handle sourceAccountNotFound in sep41Metadata simulation:
  - Updated simulateCall in sep41Metadata.js to catch sourceAccountNotFound simulation errors when sequence is "0" and automatically retry simulation with sequence "1".
  - Added JSDoc documentation and environment variable fallback (process.env.OPERATIONAL_ACCOUNT) for the simulation dummy source account.

  3. Issue [#67](../../issues/67) - Implement express-rate-limit middleware on Express API:
  - Added express-rate-limit package dependency to indexer/package.json.
  - Configured and registered rateLimit middleware in indexer/src/api.js (windowMs: 60,000 ms, max: 100 requests) to protect all API endpoints against DoS attacks.

  4. Issue [#66](../../issues/66) - Validate seq parameter in GET /api/events/:seq:
  - Added validation for req.params.seq in GET /api/events/:seq to ensure it is a non-negative integer using parseInt and regex pattern matching.
  - Returned HTTP 400 with { error: "seq must be a non-negative integer" } when given invalid inputs like non-numeric strings or negative numbers.

  Closes [#69](../../issues/69)
  Closes [#68](../../issues/68)
  Closes [#67](../../issues/67)
  Closes [#66](../../issues/66)


- Resolve frontend issues [#90](../../issues/90) [#91](../../issues/91) [#92](../../issues/92) [#93](../../issues/93) ([`5da7959`](../../commit/5da79592839c0627076ad979a3c751add9bbf36c))

[#90](../../issues/90) - Add Skeleton component with shimmer animation; replace all plain
       'Loading…' text in Home, ContractPage, WalletPage, and EventPage
       with shaped placeholder rows that match the EventTable layout,
       eliminating layout shift on data load.

  [#91](../../issues/91) - Read API base URL from VITE_API_URL env variable with '/api'
       fallback so the frontend works on separate-origin deployments
       (e.g. CDN frontend + api.pero-j.io API) without CORS errors.
       Document VITE_API_URL in .env.example.

  [#92](../../issues/92) - Configure QueryClient with staleTime: 30_000 (30 s) to prevent
       stale event-feed data. Add registerContract to api.ts and wire
       useMutation + queryClient.invalidateQueries({ queryKey: ['contract', id] })
       in ContractPage so metadata updates are reflected immediately
       after a successful POST /api/contracts.

  [#93](../../issues/93) - Add created_at?: string to DecodedEvent interface. Display it
       in EventPage as a human-readable UTC timestamp using
       new Date(ev.created_at).toUTCString(), giving users a readable
       time alongside the raw ledger number


- Resolve issues [#118](../../issues/118)-[#121](../../issues/121) — health endpoint, transfer_admin, ABI fixtures, load test ([`2a1664e`](../../commit/2a1664e8dcbfdd90dfd52bebdb20dce3ccd8802b))

Issue [#118](../../issues/118) — Contract admin key management
  - Add transfer_admin(current_admin, new_admin) to ExplorerContract; both
    parties must authorize to prevent accidental lock-out
  - Add three unit tests: happy path, unauthorized caller
  - Add SECURITY.md documenting key-management best practices and
    emergency recovery procedure

  Issue [#119](../../issues/119) — Indexer lag monitoring (GET /health)
  - Export shared health state (lastIndexedAt, lastLedger, startedAt)
    from index.js and update it after each ledger batch
  - Add GET /health endpoint to api.js: returns lag_seconds, uptime_seconds,
    last_ledger, last_indexed_at; HTTP 200 healthy / 503 degraded
  - Alert threshold configurable via LAG_ALERT_THRESHOLD_S env var (default 30)
  - Document uptime monitor setup and example responses in README

  Issue [#120](../../issues/120) — ABI fixtures for Tranche 2 deliverable 2.5
  - Add indexer/fixtures/stellarswap-abi.json (swap, add/remove liquidity, get_price)
  - Add indexer/fixtures/blend-abi.json (supply, withdraw, borrow, repay, liquidate)
  - Add make seed-testnet target to register ABIs via POST /api/contracts

  Issue [#121](../../issues/121) — Load testing
  - Add tests/load/api_load_test.js (k6): 100 VUs × 60 s on GET /api/events
  - Separate health probe scenario samples lag_seconds every 10 s
  - Thresholds: p95 < 500 ms, p99 < 1 s, error rate < 1 %, lag < 30 s
  - Add make load-test target



### Documentation

- Auto-update CHANGELOG.md [skip ci] ([`64c2488`](../../commit/64c2488417fa0d6f93df6d6dc8b500cab5b767db))

- Auto-update CHANGELOG.md [skip ci] ([`193eeee`](../../commit/193eeee984e6e2cf5193124884bae892d6d428d9))

- Add issue and PR templates ([`a63913f`](../../commit/a63913ff65e8116ff4fdde38bbed0774001f6d9e))

- Fill TEAM.md with Sunday Abel's real information ([`93c8347`](../../commit/93c8347905599d235cf94ec8b8d7ca488ab370e4))

- Fill TEAM.md with real team information ([`d45fdb4`](../../commit/d45fdb41136db37d887b1fdf8159721ecb01b6b4))


### Features

- Add CHANGELOG, JSDoc types, Node version enforcement, and linting ([`b47f6dd`](../../commit/b47f6dd58d2b4e6997f1e52781c3ac4ebad33ccc))

Add automated changelog generation:
    - cliff.toml: git-cliff config following Keep a Changelog format
    - CHANGELOG.md: seeded from git history, auto-updated on push via GitHub Actions
    - .github/workflows/changelog.yml: auto-commit CHANGELOG.md when conventional commits are pushed
    - make changelog: local regeneration target

  Add shared type definitions via JSDoc:
    - indexer/src/types.js: DecodedEvent, ContractMeta, HealthState, VolumeResult typedefs
    - decoder.js, db.js, index.js: annotated with @typedef imports and full @param/@returns
    - indexer/jsconfig.json: enable checkJs and strictNullChecks for editor type checking

  Enforce Node 20+:
    - indexer/package.json: add engines field
    - indexer/.npmrc: engine-strict=true to fail npm install on old Node

  Add code quality tooling:
    - indexer/eslint.config.js: ESLint 9 flat config (eslint:recommended + strict rules)
    - indexer/.prettierrc: consistent formatting (2 spaces, double quotes, trailing commas)
    - indexer/package.json: add lint, format, format:check scripts
    - Formatted all indexer/src/**/*.js for style consistency

  Update documentation:
    - README.md: add CHANGELOG.md link to SCF documents table
    - Makefile: add changelog target


- SAC detection, SEP-41 metadata fetcher, compliance validator, 24h volume endpoint ([`057cf07`](../../commit/057cf0757b4973bea27ef31f6d314aec26850023))

- sac.js: detect SAC bridge contracts, append classic asset code in descriptions
  - sep41Metadata.js: fetch name/symbol/decimals via simulateTransaction (read-only)
  - validateSep41.js: simulate all 10 mandatory SEP-41 functions, return compliance bool
  - db.js: get24hVolume() aggregates transfer events with NUMERIC precision
  - api.js: GET /api/tokens/:id/volume returns 24h rolling volume, zero float rounding


- Implement ScVal→JS converter and ContractAuth decoder ([`ff28c8a`](../../commit/ff28c8affce32c1d63ed0d61573fa62343e6d69c))

Closes [#3](../../issues/3) — Parse ScVal Types to Native JavaScript Types
  Closes [#4](../../issues/4) — Extract and Decode ContractAuth Arrays

  ---

  ## Issue [#3](../../issues/3) — ScVal to Native JS Type Converter (indexer/src/scval.js)

  ### Problem
  The existing decoder.js called scValToNative() from @stellar/stellar-sdk directly,
  which works for simple cases but loses precision on large integers (i64/u64/i128/u128/
  i256/u256) because JavaScript's Number type only has 53 bits of safe integer precision.
  There was also no centralised, well-typed utility that the rest of the codebase could
  import for consistent ScVal handling.

  ### Solution
  Created indexer/src/scval.js exporting a single function scValToJs(val).

  How it works:
  - Switches on val.switch().name to handle every ScVal variant explicitly.
  - Primitive types (bool, void, u32, i32, string, symbol, bytes) map directly to their
    JS equivalents.
  - Large integer types (u64, i64, timepoint, duration, u128, i128, u256, i256) are
    returned as native BigInt values, reconstructed from their hi/lo word pairs using
    bitwise shift operations, preventing any precision loss.
  - scvVec recursively maps each element through scValToJs, producing a plain JS array.
  - scvMap iterates the key/value pairs and builds a plain JS object, with keys coerced
    to strings.
  - scvAddress decodes both scAddressTypeAccount (Ed25519 public key → G... address via
    StrKey.encodeEd25519PublicKey) and scAddressTypeContract (contract hash → C... address
    via StrKey.encodeContract).
  - Ledger key and contract instance variants return descriptive sentinel objects rather
    than throwing.
  - Unknown/unhandled variants fall back to String(val) so the function never throws a
    runtime error, satisfying the acceptance criterion.

  ---

  ## Issue [#4](../../issues/4) — ContractAuth Array Extractor/Decoder (indexer/src/auth.js)

  ### Problem
  When a Soroban transaction is submitted, the InvokeHostFunctionOp XDR contains an
  auth[] vector of SorobanAuthorizationEntry objects. These entries record exactly which
  addresses authorised the invocation, the replay-prevention nonce each signer used, and
  the full tree of contract function calls being authorised. None of this was surfaced by
  the indexer, making it impossible to display authorisation information in the explorer.

  ### Solution
  Created indexer/src/auth.js exporting extractContractAuth(input).

  How it works:
  - Input flexibility: accepts either a base64 XDR string (TransactionEnvelope or bare
    Operation) or an already-parsed InvokeHostFunctionOp object. The function tries to
    parse as a full envelope first, then falls back to a bare operation, so callers do
    not need to pre-parse.
  - Auth entry decoding (decodeAuthEntry): inspects the credentials discriminant.
    - sorobanCredentialsAddress: extracts the signer address (account → G... string,
      contract → C... string) and the nonce as a BigInt.
    - sorobanCredentialsSourceAccount: signer and nonce remain null (source account
      authorisation carries no explicit address/nonce fields).
  - Invocation tree decoding (decodeInvocation, recursive): decodes the rootInvocation
    and all nested subInvocations into plain objects containing:
    - type: 'contractFn' | 'createContract' | raw discriminant name
    - contractId: C... encoded contract address
    - functionName: string name of the authorised function
    - args: array of native JS values produced by scValToJs (reuses issue [#3](../../issues/3) utility)
    - subInvocations: recursively decoded child invocations
  - Return shape per entry: { signer, nonce, rootInvocation } — directly satisfying the
    acceptance criteria of exposing the signer address, the nonce, and the root function
    call authorised


- Add XDR ContractEvent decoder utility ([`27f0a64`](../../commit/27f0a64fc7a9dfaced7942c6d5847cf4f643f7a8))

- Add indexer/src/xdr_decoder.js: decodeContractEvent(base64Xdr)
    decodes a raw ContractEvent XDR string into { contractId, type,
    topics, value } using @stellar/stellar-sdk xdr + scValToNative.
    Handles SYSTEM, CONTRACT, and DIAGNOSTIC event types. BigInt values
    are serialised as strings for JSON safety.

  - Add indexer/test/xdr_decoder.test.js: 5 unit tests covering all
    three event types, required-field presence, and BigInt serialisation.

  - Add "test" script to indexer/package.json (node --test)


- Add full Soroban Smart Block Explorer ([`90eb8a3`](../../commit/90eb8a37521e0e8efb3a6bc1a6da83c755298a8f))

- Soroban smart contract (ContractRegistry + EventDecoder)
  - Node.js indexer: Soroban RPC polling, XDR decoder, PostgreSQL, REST API
  - React frontend: Home, ContractPage, WalletPage, EventPage
  - SCF submission docs: ROADMAP.md, BUDGET.md, TEAM.md, MANIFEST.md
  - stellar.toml, Makefile, .env.example, LICENSE, .gitignore



### Miscellaneous

- Add governance, security, and development guidelines ([`5a1beab`](../../commit/5a1beab905033480fd579388b275e34fef45d31f))

- Add CONTRIBUTING.md with dev environment setup, branch naming convention,
    conventional commit format, PR checklist, code style standards, and bug
    report template
  - Add SECURITY.md with vulnerability disclosure process, supported versions,
    response timelines (24h acknowledgment, 72h triage), and responsible disclosure
    guidelines
  - Complete SEP-1 stellar.toml with mandatory fields: SIGNING_KEY, DOCUMENTATION
    (ORG_NAME, ORG_GITHUB, ORG_DESCRIPTION, ORG_URL, ORG_SUPPORT_EMAIL), and
    PRINCIPALS metadata. Include signing instructions for file verification.
  - Set NODE_ENV=production in Makefile indexer target to enable production
    optimizations in pino, express, and other Node.js libraries




