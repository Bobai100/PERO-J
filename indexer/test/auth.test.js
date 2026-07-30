/**
 * Tests for src/auth.js — extractContractAuth()
 *
 * Fixtures are real base64 XDR TransactionEnvelopes built with the Stellar SDK.
 * Two flavours are tested:
 *   1. sorobanCredentialsSourceAccount  — no signer/nonce
 *   2. sorobanCredentialsAddress        — has signer (G… address) + nonce
 *
 * The fixtures were generated once with a random Keypair and are stable.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractContractAuth } from "../src/auth.js";

// ── fixtures ──────────────────────────────────────────────────────────────────
//
// SOURCE-ACCOUNT credential envelope:
//   - 1 auth entry, sorobanCredentialsSourceAccount
//   - rootInvocation: contract=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, fn="transfer", args=[i128(100)]
const SOURCE_ACCOUNT_ENVELOPE =
  "AAAAAgAAAACfqhfuYyW1fIXy2BrDNhG+tBIjZpFUkpFgePiQsxubKgAAAGQAAAAAAAAAZQAAAAEAAAAAAAAAAAAAAABqaqETAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAABAAAACgAAAAAAAAAAAAAAAAAAAGQAAAABAAAAAAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAIdHJhbnNmZXIAAAABAAAACgAAAAAAAAAAAAAAAAAAAGQAAAAAAAAAAAAAAAA=";

// ADDRESS credential envelope:
//   - 1 auth entry, sorobanCredentialsAddress
//   - signer = GDCLGU5VJJAJGBFDS6TWXFHD7MXMITH52NGZ4PTNRQP4MD5SO6KKO6FO
//   - nonce  = 42
//   - rootInvocation: contract=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC, fn="mint", args=[i128(200)]
const ADDRESS_CREDENTIAL_ENVELOPE =
  "AAAAAgAAAADeaNOQftLqRZdvV/tD1bgEuQPsijle5sGkaznHDV/EBQAAAGQAAAAAAAAAZQAAAAEAAAAAAAAAAAAAAABqaqEmAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAAB15KLcsJwPM/q9+uf9O9NUEpVqLl5/JtFDqLIQrTRzmEAAAAEbWludAAAAAEAAAAKAAAAAAAAAAAAAAAAAAAAyAAAAAEAAAABAAAAAAAAAADEs1O1SkCTBKOXp2uU4/suxEz9002ePm2MH8YPsneUpwAAAAAAAAAqAAAD6AAAAAEAAAAAAAAAAdeSi3LCcDzP6vfrn/TvTVBKVai5efybRQ6iyEK00c5hAAAABG1pbnQAAAABAAAACgAAAAAAAAAAAAAAAAAAAMgAAAAAAAAAAAAAAAA=";

const CONTRACT_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const SIGNER_ADDRESS = "GDCLGU5VJJAJGBFDS6TWXFHD7MXMITH52NGZ4PTNRQP4MD5SO6KKO6FO";

// ── tests ─────────────────────────────────────────────────────────────────────

describe("extractContractAuth() — source-account credentials", () => {
  it("returns an array", () => {
    const result = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.ok(Array.isArray(result));
  });

  it("returns exactly one entry", () => {
    const result = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.equal(result.length, 1);
  });

  it("signer is null for source-account credentials", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.equal(entry.signer, null);
  });

  it("nonce is null for source-account credentials", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.equal(entry.nonce, null);
  });

  it("rootInvocation has correct structure", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.ok(entry.rootInvocation, "rootInvocation should exist");
    assert.ok("function" in entry.rootInvocation, "should have function key");
    assert.ok("subInvocations" in entry.rootInvocation, "should have subInvocations key");
  });

  it("rootInvocation.function.type is 'contractFn'", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.equal(entry.rootInvocation.function.type, "contractFn");
  });

  it("rootInvocation.function.contractId matches the fixture contract", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.equal(entry.rootInvocation.function.contractId, CONTRACT_ID);
  });

  it("rootInvocation.function.functionName is 'transfer'", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.equal(entry.rootInvocation.function.functionName, "transfer");
  });

  it("rootInvocation.function.args is an array", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.ok(Array.isArray(entry.rootInvocation.function.args));
  });

  it("subInvocations is an empty array", () => {
    const [entry] = extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    assert.deepEqual(entry.rootInvocation.subInvocations, []);
  });
});

describe("extractContractAuth() — address credentials", () => {
  it("returns exactly one entry", () => {
    const result = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(result.length, 1);
  });

  it("signer is the expected G… address", () => {
    const [entry] = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(entry.signer, SIGNER_ADDRESS);
  });

  it("nonce is a BigInt", () => {
    const [entry] = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(typeof entry.nonce, "bigint");
  });

  it("nonce value is 42n", () => {
    const [entry] = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(entry.nonce, 42n);
  });

  it("rootInvocation.function.type is 'contractFn'", () => {
    const [entry] = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(entry.rootInvocation.function.type, "contractFn");
  });

  it("rootInvocation.function.contractId matches the fixture contract", () => {
    const [entry] = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(entry.rootInvocation.function.contractId, CONTRACT_ID);
  });

  it("rootInvocation.function.functionName is 'mint'", () => {
    const [entry] = extractContractAuth(ADDRESS_CREDENTIAL_ENVELOPE);
    assert.equal(entry.rootInvocation.function.functionName, "mint");
  });
});

describe("extractContractAuth() — return shape guarantees", () => {
  it("every entry has signer, nonce, and rootInvocation keys", () => {
    for (const envelope of [SOURCE_ACCOUNT_ENVELOPE, ADDRESS_CREDENTIAL_ENVELOPE]) {
      const entries = extractContractAuth(envelope);
      for (const entry of entries) {
        assert.ok("signer" in entry, "missing signer");
        assert.ok("nonce" in entry, "missing nonce");
        assert.ok("rootInvocation" in entry, "missing rootInvocation");
      }
    }
  });

  it("accepts the same envelope twice without throwing", () => {
    assert.doesNotThrow(() => {
      extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
      extractContractAuth(SOURCE_ACCOUNT_ENVELOPE);
    });
  });
});
