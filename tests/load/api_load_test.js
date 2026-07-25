/**
 * PERO-J API Load Test — tests/load/api_load_test.js
 *
 * Simulates 100 concurrent users hitting GET /api/events for 60 seconds.
 * Measures p95/p99 latency and error rate per issue #121.
 *
 * Requirements:
 *   - k6 installed: https://grafana.com/docs/k6/latest/set-up/install-k6/
 *   - API_BASE_URL env var set, or defaults to http://localhost:3001
 *
 * Run:
 *   k6 run tests/load/api_load_test.js
 *
 * Run with custom URL:
 *   API_BASE_URL=https://staging.example.com k6 run tests/load/api_load_test.js
 *
 * CI (weekly against staging):
 *   k6 run --out json=results.json tests/load/api_load_test.js
 *
 * Pass/fail thresholds (checked automatically by k6):
 *   - p95 response time < 500 ms
 *   - p99 response time < 1000 ms
 *   - error rate < 1 %
 *   - health lag_seconds < 30 (sampled every 10 s)
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate  = new Rate("api_error_rate");
const lagSeconds = new Trend("health_lag_seconds", true);

// ── Test configuration ────────────────────────────────────────────────────────
const BASE_URL = __ENV.API_BASE_URL || "http://localhost:3001";

export const options = {
  scenarios: {
    // 100 concurrent users hammering GET /api/events for 60 s
    constant_events: {
      executor:          "constant-vus",
      vus:               100,
      duration:          "60s",
    },
    // Light health probe — 1 VU every 10 s — to track live lag_seconds
    health_probe: {
      executor:          "constant-arrival-rate",
      rate:              1,           // 1 iteration
      timeUnit:          "10s",       // every 10 seconds
      duration:          "60s",
      preAllocatedVUs:   1,
      maxVUs:            2,
      exec:              "probeHealth",
    },
  },

  thresholds: {
    // Core SLA: p95 < 500 ms, p99 < 1 s, error rate < 1 %
    "http_req_duration{scenario:constant_events}": [
      "p(95)<500",
      "p(99)<1000",
    ],
    api_error_rate:    ["rate<0.01"],
    // Indexer lag must stay below 30 s throughout the test
    health_lag_seconds: ["p(100)<30"],
  },
};

// ── Default scenario: GET /api/events ────────────────────────────────────────
export default function () {
  const res = http.get(`${BASE_URL}/api/events`, {
    tags: { endpoint: "events" },
  });

  const ok = check(res, {
    "status 200":          (r) => r.status === 200,
    "body is array":       (r) => Array.isArray(r.json()),
    "response time < 1s":  (r) => r.timings.duration < 1000,
  });

  errorRate.add(!ok);
  sleep(0.1); // 100 ms think time → max ~10 req/s per VU
}

// ── Health probe scenario ─────────────────────────────────────────────────────
export function probeHealth() {
  const res = http.get(`${BASE_URL}/health`, {
    tags: { endpoint: "health" },
  });

  check(res, {
    "health responds":   (r) => r.status === 200 || r.status === 503,
    "lag_seconds field": (r) => r.json("lag_seconds") !== undefined,
  });

  if (res.status === 200 || res.status === 503) {
    const lag = res.json("lag_seconds");
    if (lag !== null && typeof lag === "number") {
      lagSeconds.add(lag);
    }
  }
}
