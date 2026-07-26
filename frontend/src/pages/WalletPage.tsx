import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { StrKey } from "@stellar/stellar-sdk";
import { api } from "../api";
import EventTable from "../components/EventTable";

export default function WalletPage() {
  const { address = "" } = useParams();

  const isValidAddress = StrKey.isValidEd25519PublicKey(address);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["wallet", address],
    queryFn: () => api.wallet(address),
    enabled: !!address && isValidAddress,
  });

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
          ? <p style={{ color: "var(--muted)" }}>Loading…</p>
          : <EventTable events={events} />}
      </div>
    </div>
  );
}
