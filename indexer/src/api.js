import express from "express";
import rateLimit from "express-rate-limit";
import { db } from "./db.js";
import { fetchTokenMetadata } from "./sep41Metadata.js";
import { health } from "./index.js";

const PORT = process.env.PORT || 3001;

export function startApi() {
  const app = express();
  app.use(express.json());

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // GET /health — liveness + lag probe for uptime monitors
  // Returns HTTP 200 when healthy, 503 when lag exceeds the threshold.
  // External monitors (e.g. UptimeRobot, Better Uptime) should call this
  // every 60 seconds and alert when lag_seconds > 30.
  app.get("/health", (req, res) => {
    const LAG_ALERT_THRESHOLD_S = Number(process.env.LAG_ALERT_THRESHOLD_S || 30);
    const now = Date.now();
    const uptimeSeconds = Math.floor((now - health.startedAt) / 1000);

    let lagSeconds = null;
    if (health.lastIndexedAt !== null) {
      lagSeconds = Math.floor((now - health.lastIndexedAt) / 1000);
    }

    const degraded = lagSeconds === null || lagSeconds > LAG_ALERT_THRESHOLD_S;
    const status = degraded ? "degraded" : "ok";

    const body = {
      status,
      uptime_seconds: uptimeSeconds,
      lag_seconds: lagSeconds,
      last_ledger: health.lastLedger,
      // ISO timestamp of last successful index — handy for human readers
      last_indexed_at: health.lastIndexedAt ? new Date(health.lastIndexedAt).toISOString() : null,
    };

    // 503 lets uptime monitors that check HTTP status codes fire automatically
    res.status(degraded ? 503 : 200).json(body);
  });

  // GET /api/events?contract=&fn=&page=
  app.get("/api/events", async (req, res) => {
    try {
      const events = await db.getEvents({
        contract: req.query.contract,
        fn: req.query.fn,
        page: Number(req.query.page) || 1,
      });
      res.json(events);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/events/:seq
  app.get("/api/events/:seq", async (req, res) => {
    try {
      const seqStr = String(req.params.seq).trim();
      const seq = parseInt(seqStr, 10);
      if (isNaN(seq) || seq < 0 || !/^\d+$/.test(seqStr)) {
        return res.status(400).json({ error: "seq must be a non-negative integer" });
      }
      const ev = await db.getEvent(seq);
      if (!ev) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(ev);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/contracts/:id
  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const meta = await db.getContractMeta(req.params.id);
      if (!meta) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(meta);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/contracts  — register ABI metadata
  app.post("/api/contracts", async (req, res) => {
    try {
      await db.upsertContractMeta(req.body);
      res.status(201).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/wallet/:address
  app.get("/api/wallet/:address", async (req, res) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const result = await db.getWalletEvents(req.params.address, { page, limit });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/tokens/:id/volume  — 24-hour rolling transfer volume
  app.get("/api/tokens/:id/volume", async (req, res) => {
    try {
      const contractId = req.params.id;
      // Fetch decimals from on-chain metadata (cached via contract registry or live sim)
      let decimals = 7;
      try {
        const meta = await fetchTokenMetadata(contractId);
        decimals = meta.decimals;
      } catch {
        /* use default */
      }

      const volume = await db.get24hVolume(contractId, decimals);
      res.json({ contract_id: contractId, window: "24h", ...volume });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}
