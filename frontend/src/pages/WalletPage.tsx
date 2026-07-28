import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StrKey } from "@stellar/stellar-sdk";
import { api } from "../api";
import EventTable from "../components/EventTable";
import Skeleton from "../components/Skeleton";

export default function WalletPage() {
  const { address = "" } = useParams();
  const [page, setPage] = useState(1);

  const isValidAddress = StrKey.isValidEd25519PublicKey(address);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet", address, page],
    queryFn: () => api.wallet(address, page),
    enabled: !!address && isValidAddress,
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 25;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Wallet History</h2>
        <code style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>{address}</code>
      </div>

      <div className="card">
        {!address
          ? <p style={{ color: "var(--muted)" }}>Loading…</p>
          : !isValidAddress
          ? <p style={{ color: "var(--muted)" }}>Invalid Stellar address.</p>
          : isLoading
          ? <Skeleton />
          : <EventTable events={events} />}
      </div>

      {/* Pagination */}
      {isValidAddress && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ padding: "6px 10px", color: "var(--muted)" }}>Page {page}</span>
          <button disabled={page * limit >= total || events.length < limit} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
