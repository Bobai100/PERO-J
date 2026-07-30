/**
 * Tests for src/sac.js — detectSac() and sacLabel()
 *
 * The XLM SAC contract ID is deterministically derived from the native asset
 * and the network passphrase. On Testnet the known value is:
 *   CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
 *
 * sac.js reads process.env.NETWORK_PASSPHRASE at module load time (defaulting
 * to Networks.TESTNET), so we rely on that default for these tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Asset, Contract, Networks } from "@stellar/stellar-sdk";
import { detectSac, sacLabel } from "../src/sac.js";

// Compute the expected XLM SAC contract ID once
const XLM_SAC_ID = new Contract(
  Asset.native().contractId(Networks.TESTNET)
).contractId();

// A contract ID that is definitely NOT in KNOWN_ASSETS (StellarSwap fixture)
const NON_SAC_ID = "CBDIZJSO3SZGBYABF4RBE75QNRYNXP5KOGP7GF23JDZUOBAVNISTL52";

describe("detectSac()", () => {
  it("recognises the XLM SAC contract ID", () => {
    const { isSac, assetCode } = detectSac(XLM_SAC_ID);
    assert.equal(isSac, true);
    assert.equal(assetCode, "XLM");
  });

  it("returns isSac=false for an unregistered contract", () => {
    const { isSac, assetCode } = detectSac(NON_SAC_ID);
    assert.equal(isSac, false);
    assert.equal(assetCode, null);
  });

  it("returns isSac=false for an empty string", () => {
    const { isSac } = detectSac("");
    assert.equal(isSac, false);
  });

  it("returns isSac=false for a random string that looks like a contract ID", () => {
    // Random valid-looking but non-existent contract strkey
    const { isSac } = detectSac("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7SQET");
    assert.equal(isSac, false);
  });

  it("result object has exactly isSac and assetCode keys", () => {
    const result = detectSac(NON_SAC_ID);
    assert.ok("isSac" in result);
    assert.ok("assetCode" in result);
    assert.equal(Object.keys(result).length, 2);
  });

  it("XLM SAC assetCode is the string 'XLM'", () => {
    const { assetCode } = detectSac(XLM_SAC_ID);
    assert.equal(typeof assetCode, "string");
    assert.equal(assetCode, "XLM");
  });
});

describe("sacLabel()", () => {
  it("returns asset code for a known SAC contract", () => {
    const label = sacLabel(XLM_SAC_ID);
    assert.equal(label, "XLM");
  });

  it("returns the fallback for an unknown contract when fallback is provided", () => {
    const label = sacLabel(NON_SAC_ID, "MyToken");
    assert.equal(label, "MyToken");
  });

  it("returns the contractId as default fallback for an unknown contract", () => {
    const label = sacLabel(NON_SAC_ID);
    assert.equal(label, NON_SAC_ID);
  });

  it("does NOT return the contractId for a known SAC — uses asset code instead", () => {
    const label = sacLabel(XLM_SAC_ID, XLM_SAC_ID);
    assert.notEqual(label, XLM_SAC_ID);
    assert.equal(label, "XLM");
  });
});

describe("SAC_ASSETS env extension", () => {
  it("SAC_ASSETS env is not set in default test run — only native XLM is known", () => {
    // If SAC_ASSETS were set to add more assets this test would need updating.
    // Asserting the baseline: only XLM is in the default map.
    assert.equal(process.env.SAC_ASSETS, undefined);
    // XLM is known
    assert.equal(detectSac(XLM_SAC_ID).isSac, true);
    // The StellarSwap contract is NOT in the default known assets
    assert.equal(detectSac(NON_SAC_ID).isSac, false);
  });
});
