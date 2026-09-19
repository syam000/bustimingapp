"use client";

import { useEffect, useState } from "react";
import ModeBadge from "./components/ModeBadge.jsx";
import SearchPanel from "./components/SearchPanel.jsx";
import StopCard from "./components/StopCard.jsx";

const STORAGE_KEY = "bustiming.watchedStops.v1";

function loadWatched() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWatched(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private mode etc.) - in-memory state still works
  }
}

export default function HomePage() {
  const [mode, setMode] = useState(null);
  const [watched, setWatched] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted stops + current data mode once on mount (client only).
  useEffect(() => {
    setWatched(loadWatched());
    setHydrated(true);
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setMode(data.mode))
      .catch(() => setMode("unknown"));
  }, []);

  // Persist whenever the watched list changes (after initial hydration).
  useEffect(() => {
    if (hydrated) saveWatched(watched);
  }, [watched, hydrated]);

  function addStop(stop) {
    setWatched((prev) => (prev.some((s) => s.code === stop.code) ? prev : [...prev, stop]));
  }

  function removeStop(code) {
    setWatched((prev) => prev.filter((s) => s.code !== code));
  }

  return (
    <>
      <header className="topbar">
        <h1>🚌 SG Bus Timing</h1>
        <ModeBadge mode={mode} />
      </header>

      <main>
        <SearchPanel onAdd={addStop} />

        <section className="favorites-panel">
          <div className="favorites-header">
            <h2>Watched stops</h2>
            <span className="hint">Tap a search result to add it here.</span>
          </div>
          <div className="favorites">
            {watched.map((stop) => (
              <StopCard key={stop.code} stop={stop} onRemove={removeStop} />
            ))}
          </div>
          {hydrated && watched.length === 0 && (
            <p className="empty-state">
              No stops added yet. Search above to add a bus stop and see live arrival times.
            </p>
          )}
        </section>
      </main>

      <footer>
        <p>
          Data source:{" "}
          <a href="https://datamall.lta.gov.sg/" target="_blank" rel="noopener noreferrer">
            LTA DataMall
          </a>{" "}
          (Singapore open API) &mdash; refreshes every 15s.
          {mode && mode !== "live" && (
            <span>
              {" "}
              Running in offline MOCK mode — add LTA_ACCOUNT_KEY to .env for real timings.
            </span>
          )}
        </p>
      </footer>
    </>
  );
}
