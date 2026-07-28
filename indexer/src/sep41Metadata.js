/**
 * SEP-41 token metadata fetcher.
 * Uses read-only simulateTransaction to retrieve name, symbol, and decimals
 * from any SEP-41 compliant contract without spending fees.
 * Note: The dummy account used for simulation must exist on the target network,
 * or the indexer's operational account should be configured.
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
// Dummy source account — simulation never submits, so balance doesn't matter.
// Note: The dummy account must exist on the target network, or configure process.env.OPERATIONAL_ACCOUNT.
const DUMMY_SOURCE = process.env.OPERATIONAL_ACCOUNT || "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

/**
 * Simulate a no-arg contract call and return the native ScVal result.
 * @param {string} contractId
 * @param {string} method
 * @param {string} [sequence="0"]
 */
async function simulateCall(contractId, method, sequence = "0") {
  const account = new Account(DUMMY_SOURCE, sequence);
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method))
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    const errorStr = typeof result.error === "string" ? result.error : JSON.stringify(result.error || "");
    if (sequence === "0" && (errorStr.includes("sourceAccountNotFound") || errorStr.toLowerCase().includes("source account not found"))) {
      return simulateCall(contractId, method, "1");
    }
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
  const [name, symbol, decimals] = await Promise.all([
    simulateCall(contractId, "name"),
    simulateCall(contractId, "symbol"),
    simulateCall(contractId, "decimals"),
  ]);

  return {
    name: String(name ?? ""),
    symbol: String(symbol ?? ""),
    decimals: Number(decimals ?? 7),
  };
}
