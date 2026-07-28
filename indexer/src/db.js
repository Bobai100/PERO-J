import pg from "pg";

/** @typedef {import('./types.js').DecodedEvent} DecodedEvent */
/** @typedef {import('./types.js').ContractMeta} ContractMeta */
/** @typedef {import('./types.js').VolumeResult} VolumeResult */

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

process.on("unhandledRejection", async (err) => {
  console.error("Unhandled Rejection detected, closing database pool:", err);
  try {
    await pool.end();
  } catch (e) {
    console.error("Error closing database pool:", e);
  }
  process.exit(1);
});

export const db = {
  /** Create tables and indexes if they do not already exist.
   * @returns {Promise<void>}
   */
  async init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        seq         BIGSERIAL PRIMARY KEY,
        contract_id TEXT NOT NULL,
        function    TEXT NOT NULL,
        ledger      BIGINT NOT NULL,
        tx_hash     TEXT,
        description TEXT NOT NULL,
        raw_topics  JSONB,
        raw_data    TEXT,
        sac_asset   TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE events ADD COLUMN IF NOT EXISTS sac_asset TEXT;
      CREATE INDEX IF NOT EXISTS idx_events_contract ON events(contract_id);
      CREATE INDEX IF NOT EXISTS idx_events_function ON events(function);
      CREATE INDEX IF NOT EXISTS idx_events_ledger   ON events(ledger);

      CREATE TABLE IF NOT EXISTS indexer_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS contracts (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        functions   JSONB,
        registered_by TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  },

  /**
   * Check if database is reachable.
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      await pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Gracefully close the database connection pool.
   * @returns {Promise<void>}
   */
  async close() {
    await pool.end();
  },

  /**
   * Persist a decoded event to the database.
   * Uses ON CONFLICT DO NOTHING so duplicate events (e.g. from an indexer
   * restart) are silently skipped.
   *
   * @param {DecodedEvent} ev
   * @returns {Promise<void>}
   */
  async upsertEvent(ev) {
    await pool.query(
      `INSERT INTO events (contract_id, function, ledger, tx_hash, description, raw_topics, raw_data, sac_asset)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      [
        ev.contract_id,
        ev.function,
        ev.ledger,
        ev.tx_hash,
        ev.description,
        JSON.stringify(ev.raw_topics),
        ev.raw_data,
        ev.sac_asset ?? null,
      ]
    );
  },

  /**
   * Return a paginated list of events, optionally filtered by contract and/or function.
   *
   * @param {object}  [opts]
   * @param {string}  [opts.contract]  - Filter by contract_id (exact match).
   * @param {string}  [opts.fn]        - Filter by function name (exact match).
   * @param {number}  [opts.page=1]    - 1-based page number.
   * @param {number}  [opts.limit=25]  - Rows per page.
   * @returns {Promise<DecodedEvent[]>}
   */
  async getEvents({ contract, fn, page = 1, limit = 25 } = {}) {
    const conditions = [];
    const params = [];
    if (contract) {
      params.push(contract);
      conditions.push(`contract_id = $${params.length}`);
    }
    if (fn) {
      params.push(fn);
      conditions.push(`function = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT * FROM events ${where} ORDER BY ledger DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows;
  },

  /**
   * Fetch a single event by its auto-increment sequence number.
   *
   * @param {number} seq
   * @returns {Promise<DecodedEvent|null>} The event row, or null if not found.
   */
  async getEvent(seq) {
    const { rows } = await pool.query("SELECT * FROM events WHERE seq = $1", [seq]);
    return rows[0] ?? null;
  },

  /**
   * Return paginated events where the given address appears in the description
   * or raw_topics (case-insensitive substring match).
   *
   * @param {string} address - Stellar address (Strkey, G… or C…)
   * @param {object} [opts]
   * @param {number} [opts.page=1]  - 1-based page number.
   * @param {number} [opts.limit=25] - Rows per page.
   * @returns {Promise<{ events: DecodedEvent[], total: number, page: number, limit: number }>}
   */
  async getWalletEvents(address, { page = 1, limit = 25 } = {}) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 25;
    const offset = (pageNum - 1) * limitNum;

    const countRes = await pool.query(
      "SELECT COUNT(*) FROM events WHERE description ILIKE $1 OR raw_topics::text ILIKE $1",
      [`%${address}%`]
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const { rows } = await pool.query(
      "SELECT * FROM events WHERE description ILIKE $1 OR raw_topics::text ILIKE $1 ORDER BY ledger DESC LIMIT $2 OFFSET $3",
      [`%${address}%`, limitNum, offset]
    );

    return { events: rows, total, page: pageNum, limit: limitNum };
  },

  /**
   * Fetch ABI-like metadata for a registered contract.
   *
   * @param {string} id - Strkey-encoded contract address (C…)
   * @returns {Promise<ContractMeta|null>} The contract row, or null if not registered.
   */
  async getContractMeta(id) {
    const { rows } = await pool.query("SELECT * FROM contracts WHERE id = $1", [id]);
    return rows[0] ?? null;
  },

  /**
   * Aggregate transfer volume for a contract over the last 24 hours.
   * Amounts are stored as raw strings in raw_data; we cast via NUMERIC to
   * avoid floating-point errors and return a BigInt-safe string.
   * @param {string} contractId
   * @param {number} decimals  token decimal places (default 7)
   * @returns {Promise<VolumeResult>}
   */
  async get24hVolume(contractId, decimals = 7) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM((raw_data::jsonb->>'amount')::NUMERIC), 0)::TEXT AS volume_raw
       FROM events
       WHERE contract_id = $1
         AND function    = 'transfer'
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [contractId]
    );
    const raw = rows[0].volume_raw ?? "0";
    // Scale using integer arithmetic via BigInt to avoid float rounding
    const rawBig = BigInt(raw.split(".")[0]); // NUMERIC may have no decimals
    const divisor = 10n ** BigInt(decimals);
    const whole = rawBig / divisor;
    const fraction = rawBig % divisor;
    const volume_scaled = `${whole}.${fraction.toString().padStart(decimals, "0")}`;
    return { volume_raw: raw, volume_scaled, decimals };
  },

  /**
   * Insert or update ABI metadata for a contract.
   * On conflict (same id) updates name, description, and functions only —
   * registered_by and created_at are preserved.
   *
   * @param {ContractMeta} meta
   * @returns {Promise<void>}
   */
  async upsertContractMeta(meta) {
    await pool.query(
      `INSERT INTO contracts (id, name, description, functions, registered_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET name=$2, description=$3, functions=$4`,
      [meta.id, meta.name, meta.description, JSON.stringify(meta.functions), meta.registered_by]
    );
  },

  /**
   * Read the persisted indexer cursor from the indexer_state table.
   * @returns {Promise<number|null>} The last successfully indexed ledger, or null.
   */
  async getCursor() {
    const { rows } = await pool.query(
      "SELECT value FROM indexer_state WHERE key = 'last_ledger'"
    );
    return rows.length ? Number(rows[0].value) : null;
  },

  /**
   * Persist the indexer cursor so the process can resume from this ledger
   * after a restart.
   * @param {number} ledger
   * @returns {Promise<void>}
   */
  async setCursor(ledger) {
    await pool.query(
      `INSERT INTO indexer_state (key, value)
       VALUES ('last_ledger', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [String(ledger)]
    );
  },
};
