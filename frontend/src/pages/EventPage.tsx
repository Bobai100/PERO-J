import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import Skeleton from "../components/Skeleton";

export default function EventPage() {
  const { seq = "0" } = useParams();

  const { data: ev, isLoading } = useQuery({
    queryKey: ["event", seq],
    queryFn: () => api.event(Number(seq)),
  });

  if (isLoading) return <div className="card"><Skeleton rows={4} /></div>;
  if (!ev) return <p>Event not found.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2>Event #{ev.seq}</h2>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <Row label="Description" value={ev.description} highlight />
        <Row label="Function"    value={ev.function} badge />
        <Row label="Ledger"      value={ev.ledger.toLocaleString()} />
        {ev.created_at && <Row label="Time" value={new Date(ev.created_at).toUTCString()} />}
        <Row label="Contract"    value={<Link to={`/contract/${ev.contract_id}`}>{ev.contract_id}</Link>} />
        {ev.tx_hash && <Row label="Tx Hash" value={ev.tx_hash} mono />}
        {ev.raw_topics.length > 0 && (
          <Row label="Topics" value={ev.raw_topics.join(", ")} mono />
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight, badge, mono }: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
  badge?: boolean;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <span style={{ color: "var(--muted)", minWidth: 100 }}>{label}</span>
      {badge
        ? <span className="badge green">{value}</span>
        : <span style={{
            fontWeight: highlight ? 600 : 400,
            fontFamily: mono ? "monospace" : undefined,
            fontSize: mono ? 12 : undefined,
            wordBreak: "break-all",
          }}>{value}</span>
      }
    </div>
  );
}
