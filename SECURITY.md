# Security Policy

## Admin Key Management

The PERO-J contract uses a single privileged **admin** address that is set once at
`init()` time.  Only the admin may call `submit_event`, so key loss or compromise
permanently disrupts on-chain event submission.

### Recommendations

| Risk | Mitigation |
|------|-----------|
| Key loss | Store the admin private key on a **hardware wallet** (Ledger, Trezor). Never keep it in plain text or in a `.env` file committed to git. |
| Key compromise | Rotate immediately using `transfer_admin` (see below). |
| Single point of failure | Use a **multi-sig account** (e.g. via [Stellar multisig](https://developers.stellar.org/docs/learn/encyclopedia/transactions-specialized/multisig)) as the admin address. Require ≥ 2-of-3 signers for production. |

### Rotating the Admin Key (`transfer_admin`)

The contract exposes a `transfer_admin(current_admin, new_admin)` function.
**Both** the old and new admin must sign the transaction to prevent accidental
lock-out from a mis-typed address.

```bash
# Example using Stellar CLI (adjust network flags as needed)
stellar contract invoke \
  --id  $EXPLORER_CONTRACT_ID  \
  --source current-admin-key   \
  --network testnet             \
  -- transfer_admin             \
  --current_admin $OLD_ADMIN_ADDRESS \
  --new_admin     $NEW_ADMIN_ADDRESS
```

> The new admin must also sign.  Construct the transaction, share it with the
> new key holder, and collect their signature before submitting.

### Emergency Recovery

If the admin key is **lost** before a `transfer_admin` is executed:

1. The contract is effectively frozen — no new on-chain events can be submitted.
2. All historical data stored in the contract remains readable.
3. The off-chain PostgreSQL database (maintained by the indexer) is unaffected
   and continues to serve the REST API.
4. Recovery requires re-deploying a fresh contract instance and re-registering
   all ABIs.  Keep a backup of your `indexer/fixtures/` ABI files and the
   `seed-testnet` Makefile target for this reason.

**Preventive action:** always rotate to a multi-sig admin before going to mainnet.

## Reporting a Vulnerability

Please report security issues by opening a **private** GitHub Security Advisory
at <https://github.com/john2ydep2-gt/PERO-J/security/advisories/new>.

Do **not** open a public issue for security-sensitive bugs.

Expected response time: **48 hours**.

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main`  | ✅ Yes     |
| older   | ❌ No — please upgrade |
