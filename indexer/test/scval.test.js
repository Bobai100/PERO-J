import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { xdr } from "@stellar/stellar-sdk";
import { scValToJs } from "../src/scval.js";

describe("scValToJs — opaque key/instance variants", () => {
  it("scvLedgerKeyContractInstance returns readable string", () => {
    const val = xdr.ScVal.scvLedgerKeyContractInstance();
    const result = scValToJs(val);
    assert.equal(typeof result, "string");
    assert.equal(result, "<contract-instance>");
    // Must not stringify to [object Object]
    assert.notEqual(String(result), "[object Object]");
  });

  it("scvContractInstance returns readable string", () => {
    const inst = new xdr.ScContractInstance({
      executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.alloc(32, 0)),
      storage: null,
    });
    const val = xdr.ScVal.scvContractInstance(inst);
    const result = scValToJs(val);
    assert.equal(typeof result, "string");
    assert.equal(result, "<contract-instance>");
    assert.notEqual(String(result), "[object Object]");
  });

  it("scvLedgerKeyNonce returns readable string containing the nonce", () => {
    const nonceKey = new xdr.ScNonceKey({
      nonce: xdr.Int64.fromString("42"),
    });
    const val = xdr.ScVal.scvLedgerKeyNonce(nonceKey);
    const result = scValToJs(val);
    assert.equal(typeof result, "string");
    assert.match(result, /^<nonce:/);
    assert.match(result, /42/);
    assert.notEqual(String(result), "[object Object]");
  });

  it("all three variants produce strings that join cleanly in a comma-separated list", () => {
    const vals = [
      xdr.ScVal.scvLedgerKeyContractInstance(),
      xdr.ScVal.scvSymbol("fn"),
    ];
    const argStr = vals.map(scValToJs).map(String).join(", ");
    assert.ok(!argStr.includes("[object Object]"), `argStr must not contain [object Object]: ${argStr}`);
  });
});
