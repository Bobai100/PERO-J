import "dotenv/config";
import { SorobanRpc, xdr, StrKey } from "@stellar/stellar-sdk";
import { startApi } from "./api.js";
import { db } from "./db.js";
import { decode } from "./decoder.js";

const RPC_URL      = process.env.SOROBAN_RPC_URL    || "https://soroban-testnet.stellar.org";
const START_LEDGER = Number(process.env.START_LEDGER || 0);
const POLL_MS      = Number(process.env.POLL_MS      || 5000);

const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: true });

/**
 * Shared health state exposed to the REST API via api.js.
 * Updated each time a ledger is successfully indexed.
 */
export const health = {
  /** Timestamp (ms) of the last successfully processed ledger, or null if none yet. */
  lastIndexedAt: null,
  /** Most-recently processed ledger sequence number. */
  lastLedger: null,
  /** Process start time for uptime calculation. */
  startedAt: Date.now(),
};

async function indexLedger(ledger) {
  // getEvents supports cursor-based pagination; we use ledger range here
  const res = await rpc.getEvents({
    startLedger: ledger,
    filters: [{ type: "contract" }],
    limit: 200,
  });

  for (const ev of res.events) {
    const decoded = await decode(ev);
    await db.upsertEvent(decoded);
    console.log(`[${ev.ledger}] ${decoded.function}: ${decoded.description}`);
  }

  // Record the time we finished processing this ledger batch
  health.lastIndexedAt = Date.now();
  health.lastLedger    = res.latestLedger;

  return res.latestLedger;
}

async function run() {
  await db.init();
  startApi();

  let cursor = START_LEDGER || (await rpc.getLatestLedger()).sequence - 100;

  while (true) {
    try {
      const latest = await indexLedger(cursor);
      cursor = latest + 1;
    } catch (err) {
      console.error("Indexer error:", err.message);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

run();
