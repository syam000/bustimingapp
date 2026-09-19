"use client";

import { useEffect, useRef, useState } from "react";

export default function SearchPanel({ onAdd }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = hidden, [] = "no results"
  const containerRef = useRef(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(q), 200);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setResults(null);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  async function runSearch(q) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/stops?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      setResults(data.stops || []);
    } catch (err) {
      if (err.name !== "AbortError") console.error(err);
    }
  }

  function pick(stop) {
    onAdd({
      code: String(stop.BusStopCode),
      desc: stop.Description || "",
      road: stop.RoadName || "",
    });
    setQuery("");
    setResults(null);
  }

  return (
    <section className="search-panel" ref={containerRef}>
      <label htmlFor="searchInput">Find a bus stop</label>
      <input
        id="searchInput"
        type="text"
        inputMode="search"
        autoComplete="off"
        placeholder="Search by stop code, road, or place (e.g. 83139, Orchard, Interchange)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results !== null && (
        <ul className="search-results">
          {results.length === 0 ? (
            <li style={{ cursor: "default" }}>No matching bus stops found.</li>
          ) : (
            results.map((stop) => (
              <li
                key={stop.BusStopCode}
                tabIndex={0}
                onClick={() => pick(stop)}
                onKeyDown={(e) => e.key === "Enter" && pick(stop)}
              >
                <span className="stop-code">{stop.BusStopCode}</span>
                <span className="stop-desc">{stop.Description}</span>
                <span className="stop-road">{stop.RoadName}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}
