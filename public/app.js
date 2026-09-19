const STORAGE_KEY = "bustiming.watchedStops.v1";
const REFRESH_MS = 15_000;

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const favoritesEl = document.getElementById("favorites");
const emptyState = document.getElementById("emptyState");
const modeBadge = document.getElementById("modeBadge");
const modeNote = document.getElementById("modeNote");

/** @type {Map<string, {code:string, desc:string, road:string, timer:number|null}>} */
const watched = new Map();

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

function saveWatched() {
  const list = [...watched.values()].map(({ code, desc, road }) => ({ code, desc, road }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private mode etc.) - ignore, in-memory state still works
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function loadMode() {
  try {
    const { mode } = await fetchJson("/api/config");
    modeBadge.textContent = mode === "live" ? "Live data" : "Mock data";
    modeBadge.classList.add(mode === "live" ? "live" : "mock");
    modeNote.textContent =
      mode === "live"
        ? ""
        : " Running in offline MOCK mode — add LTA_ACCOUNT_KEY to .env for real timings.";
  } catch {
    modeBadge.textContent = "unknown";
  }
}

let searchAbort = null;
let searchDebounce = null;

searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }
  searchDebounce = setTimeout(() => runSearch(q), 200);
});

document.addEventListener("click", (e) => {
  if (!searchResults.contains(e.target) && e.target !== searchInput) {
    searchResults.hidden = true;
  }
});

async function runSearch(q) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  try {
    const res = await fetch(`/api/stops?q=${encodeURIComponent(q)}`, {
      signal: searchAbort.signal,
    });
    const data = await res.json();
    renderSearchResults(data.stops || []);
  } catch (err) {
    if (err.name !== "AbortError") console.error(err);
  }
}

function renderSearchResults(stops) {
  searchResults.innerHTML = "";
  if (stops.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No matching bus stops found.";
    li.style.cursor = "default";
    searchResults.appendChild(li);
  } else {
    for (const stop of stops) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      li.innerHTML = `
        <span class="stop-code">${stop.BusStopCode}</span>
        <span class="stop-desc">${escapeHtml(stop.Description || "")}</span>
        <span class="stop-road">${escapeHtml(stop.RoadName || "")}</span>
      `;
      const add = () => {
        addStop({
          code: String(stop.BusStopCode),
          desc: stop.Description || "",
          road: stop.RoadName || "",
        });
        searchInput.value = "";
        searchResults.hidden = true;
      };
      li.addEventListener("click", add);
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter") add();
      });
      searchResults.appendChild(li);
    }
  }
  searchResults.hidden = false;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function addStop({ code, desc, road }) {
  if (watched.has(code)) return;
  watched.set(code, { code, desc, road, timer: null });
  saveWatched();
  renderFavorites();
  startPolling(code);
}

function removeStop(code) {
  const entry = watched.get(code);
  if (entry && entry.timer) clearTimeout(entry.timer);
  watched.delete(code);
  saveWatched();
  renderFavorites();
}

function renderFavorites() {
  emptyState.hidden = watched.size > 0;
  const existingCodes = new Set([...favoritesEl.children].map((el) => el.dataset.code));
  const currentCodes = new Set(watched.keys());

  // remove cards no longer watched
  for (const child of [...favoritesEl.children]) {
    if (!currentCodes.has(child.dataset.code)) child.remove();
  }

  for (const { code, desc, road } of watched.values()) {
    if (existingCodes.has(code)) continue;
    const card = document.createElement("div");
    card.className = "stop-card";
    card.dataset.code = code;
    card.innerHTML = `
      <div class="stop-card-header">
        <div class="stop-card-title">
          <span class="name">${escapeHtml(desc) || "Bus Stop " + code}</span>
          <span class="meta">${code}${road ? " · " + escapeHtml(road) : ""}</span>
        </div>
        <button class="remove-btn" type="button">Remove</button>
      </div>
      <div class="services"><p class="stop-card-status">Loading…</p></div>
    `;
    card.querySelector(".remove-btn").addEventListener("click", () => removeStop(code));
    favoritesEl.appendChild(card);
  }
}

function formatEta(nextBus) {
  if (!nextBus || !nextBus.EstimatedArrival) return null;
  const arrival = new Date(nextBus.EstimatedArrival).getTime();
  if (Number.isNaN(arrival)) return null;
  const mins = Math.round((arrival - Date.now()) / 60_000);
  return { mins: Math.max(mins, 0), load: nextBus.Load, feature: nextBus.Feature };
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

async function refreshStop(code) {
  const card = favoritesEl.querySelector(`.stop-card[data-code="${code}"]`);
  if (!card) return;
  const servicesEl = card.querySelector(".services");

  try {
    const data = await fetchJson(`/api/arrivals?stop=${encodeURIComponent(code)}`);
    const services = data.Services || [];
    if (services.length === 0) {
      servicesEl.innerHTML = `<p class="stop-card-status">No bus services found for this stop.</p>`;
    } else {
      servicesEl.innerHTML = services
        .map((svc) => {
          const etas = [svc.NextBus, svc.NextBus2, svc.NextBus3]
            .map(formatEta)
            .filter(Boolean)
            .map((eta) => `<span class="${etaClass(eta)}">${etaLabel(eta)}</span>`)
            .join("");
          return `
            <div class="service-row">
              <span class="service-no">${escapeHtml(svc.ServiceNo)}</span>
              <div class="service-etas">${etas || '<span class="eta-pill">No data</span>'}</div>
              <span class="load-tag">${escapeHtml(svc.Operator || "")}</span>
            </div>
          `;
        })
        .join("");
    }
  } catch (err) {
    servicesEl.innerHTML = `<p class="stop-card-status error">⚠ ${escapeHtml(err.message)}</p>`;
  }
}

function startPolling(code) {
  const tick = async () => {
    await refreshStop(code);
    const entry = watched.get(code);
    if (entry) entry.timer = setTimeout(tick, REFRESH_MS);
  };
  tick();
}

function init() {
  loadMode();
  for (const stop of loadWatched()) {
    watched.set(stop.code, { ...stop, timer: null });
  }
  renderFavorites();
  for (const code of watched.keys()) startPolling(code);
}

init();
