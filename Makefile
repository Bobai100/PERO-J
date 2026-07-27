.PHONY: build test deploy indexer frontend clean seed-testnet load-test

# ── Contract ──────────────────────────────────────────────────────────────────
build:
	cargo build --release --target wasm32-unknown-unknown \
	  -p soroban-explorer-contract

test:
	cargo test -p soroban-explorer-contract

optimize:
	stellar contract optimize \
	  --wasm target/wasm32-unknown-unknown/release/soroban_explorer_contract.wasm

deploy: build optimize
	stellar contract deploy \
	  --wasm target/wasm32-unknown-unknown/release/soroban_explorer_contract.optimized.wasm \
	  --source default \
	  --network testnet

# ── Indexer ───────────────────────────────────────────────────────────────────
indexer-install:
	cd indexer && npm install

indexer:
	cd indexer && NODE_ENV=production npm start

# ── Frontend ──────────────────────────────────────────────────────────────────
frontend-install:
	cd frontend && npm install

frontend:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

# ── All ───────────────────────────────────────────────────────────────────────
install: indexer-install frontend-install

dev:
	$(MAKE) -j2 indexer frontend

clean:
	cargo clean
	rm -rf frontend/dist

# ── Testnet seed (issue #120) ─────────────────────────────────────────────────
# Register StellarSwap and Blend ABI fixtures via the running REST API.
# Requires: API running on $(API_BASE_URL) (default http://localhost:3001)
#           curl available on PATH
API_BASE_URL ?= http://localhost:3001

seed-testnet:
	@echo "Registering StellarSwap ABI..."
	curl -sf -X POST $(API_BASE_URL)/api/contracts \
	  -H "Content-Type: application/json" \
	  -d @indexer/fixtures/stellarswap-abi.json
	@echo ""
	@echo "Registering Blend ABI..."
	curl -sf -X POST $(API_BASE_URL)/api/contracts \
	  -H "Content-Type: application/json" \
	  -d @indexer/fixtures/blend-abi.json
	@echo ""
	@echo "Testnet ABIs registered."

# ── Load test (issue #121) ────────────────────────────────────────────────────
# Run the k6 load test against $(API_BASE_URL).
# Requires: k6 — https://grafana.com/docs/k6/latest/set-up/install-k6/
load-test:
	k6 run \
	  --env API_BASE_URL=$(API_BASE_URL) \
	  tests/load/api_load_test.js
