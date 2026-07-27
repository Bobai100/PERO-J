import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import EventTable from "../components/EventTable";
import Skeleton from "../components/Skeleton";

const FUNCTIONS = ["", "swap", "transfer", "mint", "burn", "stake", "unstake"];

export default function Home() {
  const [fnFilter, setFnFilter] = useState("");
  const [page, setPage] = useState(1);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", fnFilter, page],
    queryFn: () => api.events({ fn: fnFilter || undefined, page }),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Soroban Smart Block Explorer</h1>
        <p style={{ color: "var(--muted)" }}>
          Human-readable Soroban contract events on Stellar.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <label style={{ color: "var(--muted)" }}>Filter by function:</label>
        <select value={fnFilter} onChange={e => { setFnFilter(e.target.value); setPage(1); }}>
          {FUNCTIONS.map(f => <option key={f} value={f}>{f || "All"}</option>)}
        </select>
      </div>

      <div className="card">
        {isLoading ? <Skeleton /> : <EventTable events={events} />}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ padding: "6px 10px", color: "var(--muted)" }}>Page {page}</span>
        <button disabled={events.length < 25} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
