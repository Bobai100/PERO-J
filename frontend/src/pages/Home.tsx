import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import EventTable from "../components/EventTable";
import Skeleton from "../components/Skeleton";

export default function Home() {
  const [fnFilter, setFnFilter] = useState("");
  const [customFn, setCustomFn] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [page, setPage] = useState(1);

  const { data: functions = [], isLoading: functionsLoading } = useQuery({
    queryKey: ["distinctFunctions"],
    queryFn: () => api.distinctFunctions(),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["events", fnFilter, customFn, page],
    queryFn: () => api.events({ fn: useCustom ? customFn : fnFilter || undefined, page }),
  });
  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 25;

  const handleFunctionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFnFilter(value);
    setUseCustom(false);
    setCustomFn("");
    setPage(1);
  };

  const handleCustomFnChange = (value: string) => {
    setCustomFn(value);
    setUseCustom(true);
    setPage(1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Soroban Smart Block Explorer</h1>
        <p style={{ color: "var(--muted)" }}>
          Human-readable Soroban contract events on Stellar.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ color: "var(--muted)" }}>Filter by function:</label>
        <select value={fnFilter} onChange={handleFunctionChange} disabled={functionsLoading}>
          <option value="">All</option>
          {functions.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input
          type="text"
          placeholder="Or type custom function name…"
          value={useCustom ? customFn : ""}
          onChange={e => handleCustomFnChange(e.target.value)}
          style={{ flex: "0 1 200px" }}
        />
      </div>

      <div className="card">
        {isLoading ? (
          <Skeleton />
        ) : events.length === 0 && page > 1 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>
              No more events.
            </p>
            <p style={{ fontSize: 14, color: "var(--muted)" }}>
              You have reached the end of the results.
            </p>
          </div>
        ) : (
          <EventTable events={events} />
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ padding: "6px 10px", color: "var(--muted)" }}>Page {page}</span>
        <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
