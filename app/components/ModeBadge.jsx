"use client";

export default function ModeBadge({ mode }) {
  if (!mode) {
    return <span className="badge">…</span>;
  }
  return (
    <span className={`badge ${mode === "live" ? "live" : "mock"}`}>
      {mode === "live" ? "Live data" : "Mock data"}
    </span>
  );
}
