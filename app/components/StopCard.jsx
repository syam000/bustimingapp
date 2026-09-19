"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 15_000;

function formatEta(nextBus) {
  if (!nextBus || !nextBus.EstimatedArrival) return null;
  const arrival = new Date(nextBus.EstimatedArrival).getTime();
  if (Number.isNaN(arrival)) return null;
  const mins = Math.round((arrival - Date.now()) / 60_000);
  return { mins: Math.max(mins, 0) };
}

function etaLabel({ mins }) {
  if (mins <= 0) return "Arr";
  if (mins === 1) return "1 min";
  return `${mins} mins`;
}

function etaClass({ mins }) {
  if (mins <= 1) return "eta-pill arriving";
  if (mins <= 5) return "eta-pill soon";
  return "eta-pill";
}

export default function StopCard({ stop, onRemove }) {
  const [services, setServices] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        const res = await fetch(`/api/arrivals?stop=${encodeURIComponent(stop.code)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Failed to fetch arrival data.");
        } else {
          setError(null);
          setServices(data.Services || []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Network error.");
      } finally {
        if (!cancelled) timer = setTimeout(tick, REFRESH_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [stop.code]);

  return (
    <div className="stop-card">
      <div className="stop-card-header">
        <div className="stop-card-title">
          <span className="name">{stop.desc || `Bus Stop ${stop.code}`}</span>
          <span className="meta">
            {stop.code}
            {stop.road ? ` · ${stop.road}` : ""}
          </span>
        </div>
        <button className="remove-btn" type="button" onClick={() => onRemove(stop.code)}>
          Remove
        </button>
      </div>

      <div className="services">
        {error ? (
          <p className="stop-card-status error">⚠ {error}</p>
        ) : services === null ? (
          <p className="stop-card-status">Loading…</p>
        ) : services.length === 0 ? (
          <p className="stop-card-status">No bus services found for this stop.</p>
        ) : (
          services.map((svc) => {
            const etas = [svc.NextBus, svc.NextBus2, svc.NextBus3]
              .map(formatEta)
              .filter(Boolean);
            return (
              <div className="service-row" key={svc.ServiceNo}>
                <span className="service-no">{svc.ServiceNo}</span>
                <div className="service-etas">
                  {etas.length === 0 ? (
                    <span className="eta-pill">No data</span>
                  ) : (
                    etas.map((eta, i) => (
                      <span className={etaClass(eta)} key={i}>
                        {etaLabel(eta)}
                      </span>
                    ))
                  )}
                </div>
                <span className="load-tag">{svc.Operator || ""}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
