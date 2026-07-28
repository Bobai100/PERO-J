import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import EventTable from "../components/EventTable";
import Skeleton from "../components/Skeleton";

const FUNCTIONS = ["", "swap", "transfer", "mint", "burn", "stake", "unstake"];

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [fnFilter, setFnFilter] = useState(searchParams.get("fn") || "");
  const [contractFilter, setContractFilter] = useState(searchParams.get("contract") || "");
  const [page, setPage] = useState(1);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (fnFilter) params.set("fn", fnFilter);
    if (contractFilter) params.set("contract", contractFilter);
    setSearchParams(params, { replace: true });
  }, [fnFilter, contractFilter, setSearchParams]);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events", fnFilter, contractFilter, page],
    queryFn: () => api.events({ 
      fn: fnFilter || undefined, 
      contract: contractFilter || undefined,
      page 
    }),
  });

  const handleFilterChange = (fn: string) => {
    setFnFilter(fn);
    setPage(1);
  };

  const handleContractFilterChange = (contract: string) => {
    setContractFilter(contract);
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
        <select value={fnFilter} onChange={e => handleFilterChange(e.target.value)}>
          {FUNCTIONS.map(f => <option key={f} value={f}>{f || "All"}</option>)}
        </select>
        {contractFilter && (
          <>
            <span style={{ color: "var(--muted)" }}>|</span>
            <span style={{ color: "var(--muted)" }}>Contract:</span>
            <code style={{ fontSize: 12, color: "var(--text)" }}>{contractFilter.slice(0, 8)}…</code>
            <button 
              onClick={() => handleContractFilterChange("")}
              style={{ padding: "4px 8px", fontSize: 12 }}
            >
              Clear
            </button>
          </>
        )}
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
        <button disabled={events.length < 25} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}
