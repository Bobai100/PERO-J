/**
 * SEP-41 token metadata fetcher.
 * Uses read-only simulateTransaction to retrieve name, symbol, and decimals
 * from any SEP-41 compliant contract without spending fees.
 */
import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Account,
  Contract,
  scValToNative,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
// Dummy source account — simulation never submits, so balance doesn't matter
const DUMMY_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

const contractCache = new Map();

function getContract(contractId) {
  if (!contractCache.has(contractId)) {
    contractCache.set(contractId, new Contract(contractId));
  }
  return contractCache.get(contractId);
}

const dummyAccount = new Account(DUMMY_SOURCE, "0");

/**
 * Simulate a no-arg contract call and return the native ScVal result.
 */
async function simulateCall(contractOrId, method) {
  const contract = typeof contractOrId === "string" ? getContract(contractOrId) : contractOrId;
  const tx = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new Error(`simulate ${method} failed: ${result.error}`);
  }
  const retval = result.result?.retval;
  return retval ? scValToNative(retval) : null;
}

/**
 * Fetch SEP-41 token metadata for a given contract ID.
 * @param {string} contractId  Strkey-encoded contract address
 * @returns {Promise<{ name: string, symbol: string, decimals: number }>}
 */
export async function fetchTokenMetadata(contractId) {
  const contract = getContract(contractId);
  const [name, symbol, decimals] = await Promise.all([
    simulateCall(contract, "name"),
    simulateCall(contract, "symbol"),
    simulateCall(contract, "decimals"),
  ]);

  return {
    name: String(name ?? ""),
    symbol: String(symbol ?? ""),
    decimals: Number(decimals ?? 7),
  };
}
