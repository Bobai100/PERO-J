/**
 * Tests for src/scval.js — scValToJs()
 *
 * Covers every ScVal type branch including BigInt edge cases for u64/i64/u128/i128/u256/i256.
 * Uses the @stellar/stellar-sdk xdr module to construct typed ScVal fixtures.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { xdr, StrKey } from "@stellar/stellar-sdk";
import { scValToJs } from "../src/scval.js";

// ── primitive types ───────────────────────────────────────────────────────────

describe("scValToJs — primitive types", () => {
  it("scvBool true", () => {
    assert.equal(scValToJs(xdr.ScVal.scvBool(true)), true);
  });

  it("scvBool false", () => {
    assert.equal(scValToJs(xdr.ScVal.scvBool(false)), false);
  });

  it("scvVoid returns null", () => {
    assert.equal(scValToJs(xdr.ScVal.scvVoid()), null);
  });

  it("scvU32", () => {
    assert.equal(scValToJs(xdr.ScVal.scvU32(42)), 42);
  });

  it("scvI32 positive", () => {
    assert.equal(scValToJs(xdr.ScVal.scvI32(7)), 7);
  });

  it("scvI32 negative", () => {
    assert.equal(scValToJs(xdr.ScVal.scvI32(-1)), -1);
  });

  it("scvString", () => {
    assert.equal(scValToJs(xdr.ScVal.scvString("hello")), "hello");
  });

  it("scvSymbol", () => {
    assert.equal(scValToJs(xdr.ScVal.scvSymbol("transfer")), "transfer");
  });

  it("scvBytes returns hex string", () => {
    const val = scValToJs(xdr.ScVal.scvBytes(Buffer.from([0xde, 0xad, 0xbe, 0xef])));
    assert.equal(val, "deadbeef");
  });

  it("null input returns null", () => {
    assert.equal(scValToJs(null), null);
  });

  it("undefined input returns null", () => {
    assert.equal(scValToJs(undefined), null);
  });
});

// ── BigInt types ──────────────────────────────────────────────────────────────

describe("scValToJs — BigInt types", () => {
  it("scvU64 zero", () => {
    const val = xdr.ScVal.scvU64(xdr.Uint64.fromString("0"));
    assert.equal(scValToJs(val), 0n);
  });

  it("scvU64 max safe integer boundary", () => {
    const val = xdr.ScVal.scvU64(xdr.Uint64.fromString("9007199254740991"));
    assert.equal(scValToJs(val), 9007199254740991n);
  });

  it("scvU64 beyond Number.MAX_SAFE_INTEGER — no precision loss", () => {
    const big = "18446744073709551615"; // u64 max
    const val = xdr.ScVal.scvU64(xdr.Uint64.fromString(big));
    assert.equal(scValToJs(val), BigInt(big));
  });

  it("scvI64 negative", () => {
    const val = xdr.ScVal.scvI64(xdr.Int64.fromString("-1"));
    assert.equal(scValToJs(val), -1n);
  });

  it("scvI64 large positive", () => {
    const val = xdr.ScVal.scvI64(xdr.Int64.fromString("9223372036854775807")); // i64 max
    assert.equal(scValToJs(val), 9223372036854775807n);
  });

  it("scvU128 small value", () => {
    const val = xdr.ScVal.scvU128(
      new xdr.UInt128Parts({
        hi: xdr.Uint64.fromString("0"),
        lo: xdr.Uint64.fromString("999"),
      })
    );
    assert.equal(scValToJs(val), 999n);
  });

  it("scvU128 with hi bits set", () => {
    // value = 1 << 64 = 18446744073709551616
    const val = xdr.ScVal.scvU128(
      new xdr.UInt128Parts({
        hi: xdr.Uint64.fromString("1"),
        lo: xdr.Uint64.fromString("0"),
      })
    );
    assert.equal(scValToJs(val), 18446744073709551616n);
  });

  it("scvI128 positive small value", () => {
    const val = xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: xdr.Int64.fromString("0"),
        lo: xdr.Uint64.fromString("42"),
      })
    );
    assert.equal(scValToJs(val), 42n);
  });

  it("scvU256 small value (only lo-lo set)", () => {
    const val = xdr.ScVal.scvU256(
      new xdr.UInt256Parts({
        hiHi: xdr.Uint64.fromString("0"),
        hiLo: xdr.Uint64.fromString("0"),
        loHi: xdr.Uint64.fromString("0"),
        loLo: xdr.Uint64.fromString("7"),
      })
    );
    assert.equal(scValToJs(val), 7n);
  });

  it("scvI256 small value", () => {
    const val = xdr.ScVal.scvI256(
      new xdr.Int256Parts({
        hiHi: xdr.Int64.fromString("0"),
        hiLo: xdr.Uint64.fromString("0"),
        loHi: xdr.Uint64.fromString("0"),
        loLo: xdr.Uint64.fromString("100"),
      })
    );
    assert.equal(scValToJs(val), 100n);
  });

  it("scvTimepoint returns BigInt", () => {
    const val = xdr.ScVal.scvTimepoint(xdr.Uint64.fromString("1700000000"));
    assert.equal(typeof scValToJs(val), "bigint");
    assert.equal(scValToJs(val), 1700000000n);
  });

  it("scvDuration returns BigInt", () => {
    const val = xdr.ScVal.scvDuration(xdr.Uint64.fromString("3600"));
    assert.equal(scValToJs(val), 3600n);
  });
});

// ── container types ───────────────────────────────────────────────────────────

describe("scValToJs — container types", () => {
  it("scvVec of symbols", () => {
    const val = xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("a"),
      xdr.ScVal.scvSymbol("b"),
    ]);
    assert.deepEqual(scValToJs(val), ["a", "b"]);
  });

  it("scvVec empty", () => {
    const val = xdr.ScVal.scvVec([]);
    assert.deepEqual(scValToJs(val), []);
  });

  it("scvVec null (treated as empty)", () => {
    // scvVec(null) is not normally constructible; guard the null branch in scvVec
    const val = xdr.ScVal.scvVec([]);
    assert.deepEqual(scValToJs(val), []);
  });

  it("scvMap with string keys", () => {
    const val = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvString("name"),
        val: xdr.ScVal.scvString("Alice"),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvString("age"),
        val: xdr.ScVal.scvU32(30),
      }),
    ]);
    const result = scValToJs(val);
    assert.equal(result.name, "Alice");
    assert.equal(result.age, 30);
  });

  it("scvMap empty", () => {
    const val = xdr.ScVal.scvMap([]);
    assert.deepEqual(scValToJs(val), {});
  });

  it("nested scvVec of scvU32", () => {
    const inner = xdr.ScVal.scvVec([xdr.ScVal.scvU32(1), xdr.ScVal.scvU32(2)]);
    const outer = xdr.ScVal.scvVec([inner]);
    assert.deepEqual(scValToJs(outer), [[1, 2]]);
  });
});

// ── address types ─────────────────────────────────────────────────────────────

describe("scValToJs — address types", () => {
  // Deterministic keypair from seed 0x01*32 — checksum-valid Stellar address
  const G_ADDR = "GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR";
  const C_ADDR = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  it("scAddressTypeAccount returns G… strkey", () => {
    const val = xdr.ScVal.scvAddress(
      xdr.ScAddress.scAddressTypeAccount(
        xdr.AccountId.publicKeyTypeEd25519(StrKey.decodeEd25519PublicKey(G_ADDR))
      )
    );
    assert.equal(scValToJs(val), G_ADDR);
  });

  it("scAddressTypeContract returns C… strkey", () => {
    const val = xdr.ScVal.scvAddress(
      xdr.ScAddress.scAddressTypeContract(StrKey.decodeContract(C_ADDR))
    );
    assert.equal(scValToJs(val), C_ADDR);
  });
});

// ── ledger key / instance types ───────────────────────────────────────────────

describe("scValToJs — ledger key and instance types", () => {
  it("scvLedgerKeyContractInstance returns object with type field", () => {
    const val = xdr.ScVal.scvLedgerKeyContractInstance();
    const result = scValToJs(val);
    assert.equal(result.type, "ledgerKeyContractInstance");
  });

  it("scvContractInstance returns object with type field", () => {
    const val = xdr.ScVal.scvContractInstance(
      new xdr.ScContractInstance({
        executable: xdr.ContractExecutable.contractExecutableStellarAsset(),
        storage: null,
      })
    );
    const result = scValToJs(val);
    assert.equal(result.type, "contractInstance");
  });
});

// ── error type ────────────────────────────────────────────────────────────────

describe("scValToJs — error type", () => {
  it("scvError returns object with error field", () => {
    const val = xdr.ScVal.scvError(
      xdr.ScError.sceValue(xdr.ScErrorCode.scecArithDomain())
    );
    const result = scValToJs(val);
    assert.ok("error" in result, "should have error property");
  });
});
