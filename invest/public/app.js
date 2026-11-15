import { planInvest, planRebalance, portfolioSummary, blendedExpenseRatio, projectGrowth } from "/lib/allocate.js";
import { MODEL_PORTFOLIOS, getInstrument } from "/lib/universe.js";

const STORE_KEY = "easyinvest.v1";
const $ = (id) => document.getElementById(id);

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
const money0 = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (x, dp = 1) => `${(x * 100).toFixed(dp)}%`;
const fmtShares = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, ""));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- state ----------

const defaultState = () => ({
  positions: [], // { symbol, name, type, expenseRatio, target, shares }
  history: [],
  settings: { amount: 1000, mode: "invest", frac: "whole", minOrder: 0, fee: 0 },
  grow: { monthly: 500, years: 20, ret: 0.06 },
});

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return defaultState();
}

let state = load();
let quotes = {}; // symbol -> quote
let lastPlan = null;

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- data ----------

async function api(path) {
  const res = await fetch(path);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

async function refreshQuotes() {
  const symbols = state.positions.map((p) => p.symbol);
  if (symbols.length === 0) return;
  try {
    const data = await api(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
    Object.assign(quotes, data.quotes);
    $("price-asof").textContent = `Prices as of ${new Date(data.asOf).toLocaleTimeString()}`;
  } catch (err) {
    toast(`Couldn't load prices: ${err.message}`);
  }
  renderPositions();
}

const priceOf = (sym) => (quotes[sym] && quotes[sym].price) || 0;

function plannerPositions() {
  return state.positions.map((p) => ({ symbol: p.symbol, price: priceOf(p.symbol), shares: p.shares, target: p.target }));
}

// ---------- step 1: mix ----------

function renderModels() {
  $("models").innerHTML = MODEL_PORTFOLIOS.map(
    (m) => `<button type="button" class="model" data-id="${m.id}">
      <strong>${esc(m.name)}</strong>
      <div class="blurb">${esc(m.blurb)}</div>
      <div class="mix">${m.holdings.map((h) => `${h.target}% ${h.symbol}`).join(" · ")}</div>
    </button>`
  ).join("");
}

function applyModel(id) {
  const m = MODEL_PORTFOLIOS.find((x) => x.id === id);
  if (!m) return;
  const owned = new Map(state.positions.map((p) => [p.symbol, p]));
  if (state.positions.some((p) => p.shares > 0)) {
    if (!confirm(`Switch your targets to "${m.name}"? Shares you own are kept; holdings not in this model get a 0% target.`)) return;
  }
  const next = m.holdings.map((h) => ({ ...instrumentFields(h.symbol), target: h.target, shares: owned.get(h.symbol)?.shares || 0 }));
  for (const p of state.positions) {
    if (p.shares > 0 && !m.holdings.some((h) => h.symbol === p.symbol)) next.push({ ...p, target: 0 });
  }
  state.positions = next;
  save();
  renderAll();
  refreshQuotes();
  toast(`Loaded "${m.name}"`);
}

function instrumentFields(symbol, fallback = {}) {
  const inst = getInstrument(symbol);
  return {
    symbol,
    name: inst?.name || fallback.name || symbol,
    type: inst?.type || fallback.type || "",
    expenseRatio: inst ? inst.expenseRatio : fallback.expenseRatio ?? null,
  };
}

function addPosition(item) {
  if (state.positions.some((p) => p.symbol === item.symbol)) {
    toast(`${item.symbol} is already in your mix`);
    return;
  }
  state.positions.push({ ...instrumentFields(item.symbol, item), target: 0, shares: 0 });
  save();
  renderAll();
  refreshQuotes();
  // Focus the new target input so the user can type a %.
  requestAnimationFrame(() => document.querySelector(`input[data-sym="${CSS.escape(item.symbol)}"][data-f="target"]`)?.focus());
}

function renderPositions() {
  const body = $("positions-body");
  const summary = portfolioSummary(plannerPositions());
  const targetSum = state.positions.reduce((a, p) => a + (Number(p.target) || 0), 0);
  $("empty-mix").hidden = state.positions.length > 0;

  body.innerHTML = state.positions
    .map((p, i) => {
      const q = quotes[p.symbol];
      const row = summary.rows[i];
      let priceCell = '<span class="muted">…</span>';
      if (q) {
        const chg = q.prevClose ? (q.price - q.prevClose) / q.prevClose : 0;
        const tag = q.fallback ? '<span class="tag warn" title="No live quote for this symbol; showing an estimate">EST</span>' : "";
        priceCell = `${money.format(q.price)}${tag}<span class="chg ${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "+" : ""}${pct(chg, 2)}</span>`;
      }
      const typeTag = p.type ? `<span class="tag">${esc(p.type)}</span>` : "";
      return `<tr>
        <td class="holding"><span class="sym">${esc(p.symbol)}</span>${typeTag}<div class="name" title="${esc(p.name)}">${esc(p.name)}</div></td>
        <td class="num">${priceCell}</td>
        <td class="num"><input type="number" min="0" max="100" step="any" value="${p.target}" data-sym="${esc(p.symbol)}" data-f="target" aria-label="Target percent for ${esc(p.symbol)}" /></td>
        <td class="num"><input type="number" min="0" step="any" value="${p.shares}" data-sym="${esc(p.symbol)}" data-f="shares" aria-label="Shares of ${esc(p.symbol)} you own" /></td>
        <td class="num">${money.format(row.value)}</td>
        <td class="num">${summary.total > 0 ? pct(row.weight) : "–"}</td>
        <td><button type="button" class="x" data-remove="${esc(p.symbol)}" aria-label="Remove ${esc(p.symbol)}">×</button></td>
      </tr>`;
    })
    .join("");

  const okSum = Math.abs(targetSum - 100) < 0.01;
  $("target-total").innerHTML = state.positions.length ? `<span class="${okSum ? "ok" : "bad"}">${+targetSum.toFixed(2)}%</span>` : "";
  $("target-status").innerHTML = !state.positions.length
    ? ""
    : okSum
      ? '<span class="ok">Targets add up ✓</span>'
      : `<span class="bad">Targets should add up to 100%</span>`;
  $("value-total").textContent = state.positions.length ? money.format(summary.total) : "";
  renderGrowth();
}

// ---------- search ----------

let searchTimer = null;
let searchItems = [];
let searchSel = -1;
let searchSeq = 0;
let searchPending = null; // promise for the latest typed query

function renderSearch() {
  const ul = $("search-results");
  ul.hidden = searchItems.length === 0;
  ul.innerHTML = searchItems
    .map((r, i) => {
      const er = r.expenseRatio ? ` · ${pct(r.expenseRatio, 2)} fee` : "";
      return `<li role="option" data-i="${i}" aria-selected="${i === searchSel}">
        <span><span class="sym">${esc(r.symbol)}</span> <span class="muted">${esc(r.name)}</span></span>
        <span class="meta">${esc(r.type || "")}${r.category ? " · " + esc(r.category) : ""}${er}</span>
      </li>`;
    })
    .join("");
}

async function runSearch(q) {
  const seq = ++searchSeq;
  try {
    const data = await api(`/api/search?q=${encodeURIComponent(q)}`);
    if (seq !== searchSeq) return; // a newer query superseded this one
    searchItems = data.results;
    // Let people add any ticker even if it isn't in the list.
    const typed = q.trim().toUpperCase();
    if (/^[A-Z0-9.\-]{1,15}$/.test(typed) && !searchItems.some((r) => r.symbol === typed)) {
      searchItems.push({ symbol: typed, name: "Add this ticker", type: "" });
    }
    searchSel = searchItems.length ? 0 : -1;
    renderSearch();
  } catch (err) {
    toast(err.message);
  }
}

function pickSearch(i) {
  const item = searchItems[i];
  if (!item) return;
  addPosition(item.name === "Add this ticker" ? { symbol: item.symbol } : item);
  $("search-input").value = "";
  searchItems = [];
  renderSearch();
}

// ---------- step 2: invest ----------

function readSettings() {
  const s = state.settings;
  s.amount = Number($("amount").value) || 0;
  s.mode = document.querySelector('input[name="mode"]:checked').value;
  s.frac = document.querySelector('input[name="frac"]:checked').value;
  s.minOrder = Number($("min-order").value) || 0;
  s.fee = Number($("fee").value) || 0;
  save();
  return s;
}

function writeSettings() {
  const s = state.settings;
  $("amount").value = s.amount;
  $("min-order").value = s.minOrder;
  $("fee").value = s.fee;
  document.querySelector(`input[name="mode"][value="${s.mode}"]`).checked = true;
  document.querySelector(`input[name="frac"][value="${s.frac}"]`).checked = true;
}

function calculate() {
  const s = readSettings();
  if (!state.positions.length) return toast("Add some holdings in step 1 first");
  const targetSum = state.positions.reduce((a, p) => a + (Number(p.target) || 0), 0);
  if (targetSum <= 0) return toast("Give at least one holding a target %");
  if (s.mode === "invest" && s.amount <= 0) return toast("Enter an amount to invest");

  const opts = { fractional: s.frac === "fractional", minOrder: s.minOrder, feePerOrder: s.fee };
  const before = portfolioSummary(plannerPositions());
  const plan = s.mode === "rebalance" ? planRebalance(plannerPositions(), s.amount, opts) : planInvest(plannerPositions(), s.amount, opts);
  lastPlan = { ...plan, mode: s.mode, amount: s.amount, at: new Date().toISOString() };
  renderPlan(plan, before, s, Math.abs(targetSum - 100) >= 0.01);
}

function renderPlan(plan, before, s, scaled) {
  $("plan").hidden = false;
  const stats = [
    ["Orders", String(plan.orders.length)],
    [s.mode === "rebalance" ? "Buys" : "Invested", money.format(plan.spent)],
  ];
  if (s.mode === "rebalance") stats.push(["Sells", money.format(plan.proceeds)]);
  if (plan.fees) stats.push(["Fees", money.format(plan.fees)]);
  stats.push(["Cash left over", money.format(plan.leftover)]);
  $("plan-summary").innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");

  $("orders-body").innerHTML = plan.orders.length
    ? plan.orders
        .map(
          (o) => `<tr>
          <td><span class="side ${o.side}">${o.side}</span></td>
          <td><strong>${esc(o.symbol)}</strong></td>
          <td class="num">${fmtShares(o.shares)}</td>
          <td class="num">${money.format(o.price)}</td>
          <td class="num">${money.format(o.amount)}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">Nothing to do: ${s.mode === "rebalance" ? "you're already on target." : "not enough cash for a single share. Try fractional shares or a bigger amount."}</td></tr>`;

  const notes = [];
  if (scaled) notes.push("Your targets don't add up to 100%, so they were scaled proportionally.");
  for (const sk of plan.skipped) notes.push(`${sk.symbol} skipped: ${sk.reason}.`);
  if (s.frac === "whole" && plan.leftover > 0 && plan.orders.length) notes.push("Whole shares leave a little cash over. Switch to fractional shares if your broker supports them.");
  $("plan-note").textContent = notes.join(" ");

  const scale = Math.max(0.0001, ...plan.after.map((a) => Math.max(a.weight, a.target)), ...before.rows.map((r) => r.weight));
  $("drift-bars").innerHTML = plan.after
    .map((a, i) => {
      const b = before.rows[i];
      const w = (x) => `${Math.min(100, (x / scale) * 100)}%`;
      return `<div class="drift-row">
        <strong>${esc(a.symbol)}</strong>
        <div class="bar" title="Top: before · Bottom: after · Line: target">
          <div class="before" style="width:${w(b.weight)}"></div>
          <div class="after" style="width:${w(a.weight)}"></div>
          <div class="target" style="left:${w(a.target)}"></div>
        </div>
        <span class="pct muted">${before.total > 0 ? pct(b.weight) : "0%"} → <strong>${pct(a.weight)}</strong> <span class="small">(target ${pct(a.target, 0)})</span></span>
      </div>`;
    })
    .join("");
  $("plan").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function ordersText() {
  if (!lastPlan) return "";
  return lastPlan.orders.map((o) => `${o.side} ${fmtShares(o.shares)} ${o.symbol} @ ~${o.price.toFixed(2)} (≈ ${money.format(o.amount)})`).join("\n");
}

function downloadCsv() {
  if (!lastPlan?.orders.length) return toast("No orders to export");
  const rows = [["side", "symbol", "shares", "est_price", "est_total"], ...lastPlan.orders.map((o) => [o.side, o.symbol, o.shares, o.price, o.amount])];
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function applyPlan() {
  if (!lastPlan?.orders.length) return toast("No orders to apply");
  for (const o of lastPlan.orders) {
    const p = state.positions.find((x) => x.symbol === o.symbol);
    if (!p) continue;
    const delta = o.side === "BUY" ? o.shares : -o.shares;
    p.shares = Math.max(0, Math.round((Number(p.shares) + delta) * 1e6) / 1e6);
  }
  state.history.unshift({ at: new Date().toISOString(), mode: lastPlan.mode, orders: lastPlan.orders, spent: lastPlan.spent, proceeds: lastPlan.proceeds || 0 });
  state.history = state.history.slice(0, 50);
  lastPlan = null;
  $("plan").hidden = true;
  save();
  renderAll();
  toast("Holdings updated. Nice work!");
}

// ---------- step 3: growth ----------

function writeGrow() {
  const g = state.grow;
  $("g-monthly").value = g.monthly;
  $("g-years").value = g.years;
  const r = document.querySelector(`input[name="ret"][value="${g.ret}"]`);
  if (r) r.checked = true;
}

function renderGrowth() {
  const g = state.grow;
  $("g-years-out").textContent = `${g.years} year${g.years === 1 ? "" : "s"}`;
  const start = portfolioSummary(plannerPositions()).total;
  const er = blendedExpenseRatio(
    state.positions.map((p) => p.target),
    state.positions.map((p) => p.expenseRatio || 0)
  );
  const pts = projectGrowth({ start, monthly: g.monthly, years: g.years, annualReturn: g.ret, expenseRatio: er });
  const last = pts.at(-1);
  const feeCost = last.valueNoFees - last.value;

  $("g-stats").innerHTML = [
    ["Projected value", money0.format(last.value)],
    ["You put in", money0.format(last.contributed)],
    ["Growth", money0.format(last.value - last.contributed)],
    [`Fund fees (${pct(er, 2)}/yr)`, `−${money0.format(feeCost)}`],
  ]
    .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`)
    .join("");

  drawChart(pts);
}

function drawChart(pts) {
  const W = 600, H = 260, L = 56, R = 12, T = 12, B = 28;
  const maxY = Math.max(1, ...pts.map((p) => p.value));
  const maxX = pts.at(-1).year || 1;
  const x = (yr) => L + (yr / maxX) * (W - L - R);
  const y = (v) => T + (1 - v / maxY) * (H - T - B);
  const line = (key) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const ticks = 4;
  let grid = "";
  for (let i = 0; i <= ticks; i++) {
    const v = (maxY / ticks) * i;
    grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" />`;
    grid += `<text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
  }
  const step = maxX > 20 ? 10 : 5;
  for (let yr = 0; yr <= maxX; yr += step) grid += `<text class="axis" x="${x(yr)}" y="${H - 8}" text-anchor="middle">${yr === 0 ? "Now" : `${yr}y`}</text>`;
  const area = `${line("value")} L${x(maxX)},${y(0)} L${x(0)},${y(0)} Z`;
  $("g-chart").innerHTML = `${grid}<path class="area" d="${area}" /><path class="contrib" d="${line("contributed")}" /><path class="line" d="${line("value")}" />`;
}

function compact(v) {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

// ---------- history ----------

function renderHistory() {
  $("history-empty").hidden = state.history.length > 0;
  $("history").innerHTML = state.history
    .map((h) => {
      const what = h.orders.map((o) => `${o.side === "BUY" ? "+" : "−"}${fmtShares(o.shares)} ${esc(o.symbol)}`).join(", ");
      return `<li><time datetime="${h.at}">${new Date(h.at).toLocaleString()}</time>${h.mode === "rebalance" ? "Rebalanced" : `Invested ${money.format(h.spent)}`}: ${what}</li>`;
    })
    .join("");
}

function renderAll() {
  renderPositions();
  renderHistory();
}

// ---------- events ----------

function bind() {
  $("models").addEventListener("click", (e) => {
    const b = e.target.closest(".model");
    if (b) applyModel(b.dataset.id);
  });

  $("positions-body").addEventListener("change", (e) => {
    const input = e.target.closest("input[data-sym]");
    if (!input) return;
    const p = state.positions.find((x) => x.symbol === input.dataset.sym);
    if (!p) return;
    p[input.dataset.f] = Math.max(0, Number(input.value) || 0);
    save();
    renderPositions();
  });
  $("positions-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    state.positions = state.positions.filter((p) => p.symbol !== b.dataset.remove);
    save();
    renderAll();
  });

  $("even-btn").addEventListener("click", () => {
    const n = state.positions.length;
    if (!n) return;
    const each = Math.floor((100 / n) * 100) / 100;
    state.positions.forEach((p, i) => (p.target = i === 0 ? +(100 - each * (n - 1)).toFixed(2) : each));
    save();
    renderPositions();
  });
  $("refresh-btn").addEventListener("click", refreshQuotes);

  const input = $("search-input");
  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const q = input.value;
    if (!q.trim()) {
      searchItems = [];
      return renderSearch();
    }
    searchSeq++; // invalidate any in-flight result for older text
    searchPending = new Promise((resolve) => {
      searchTimer = setTimeout(() => runSearch(q).then(resolve), 200);
    });
  });
  input.addEventListener("focus", () => {
    if (!input.value.trim()) runSearch("");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!searchItems.length) return;
      searchSel = (searchSel + (e.key === "ArrowDown" ? 1 : -1) + searchItems.length) % searchItems.length;
      renderSearch();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!input.value.trim()) return;
      // If the user typed faster than the debounce, search now, then pick.
      clearTimeout(searchTimer);
      const pending = searchPending;
      searchPending = null;
      (pending ? runSearch(input.value) : Promise.resolve()).then(() => pickSearch(searchSel));
    } else if (e.key === "Escape") {
      searchItems = [];
      renderSearch();
    }
  });
  $("search-results").addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-i]");
    if (li) {
      e.preventDefault();
      pickSearch(Number(li.dataset.i));
    }
  });
  input.addEventListener("blur", () => setTimeout(() => ((searchItems = []), renderSearch()), 120));

  $("invest-form").addEventListener("submit", (e) => {
    e.preventDefault();
    calculate();
  });
  $("invest-form").addEventListener("change", readSettings);
  $("copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ordersText());
      toast("Order list copied");
    } catch {
      toast("Copy failed. Select the table and copy manually.");
    }
  });
  $("csv-btn").addEventListener("click", downloadCsv);
  $("apply-btn").addEventListener("click", applyPlan);

  const growChanged = () => {
    state.grow.monthly = Math.max(0, Number($("g-monthly").value) || 0);
    state.grow.years = Number($("g-years").value) || 1;
    state.grow.ret = Number(document.querySelector('input[name="ret"]:checked').value);
    save();
    renderGrowth();
  };
  $("g-monthly").addEventListener("input", growChanged);
  $("g-years").addEventListener("input", growChanged);
  document.querySelectorAll('input[name="ret"]').forEach((r) => r.addEventListener("change", growChanged));

  $("reset-btn").addEventListener("click", () => {
    if (!confirm("Clear your holdings, targets and activity from this browser?")) return;
    state = defaultState();
    save();
    quotes = {};
    $("plan").hidden = true;
    writeSettings();
    writeGrow();
    renderAll();
  });
}

async function init() {
  renderModels();
  writeSettings();
  writeGrow();
  bind();
  renderAll();
  try {
    const cfg = await api("/api/config");
    const badge = $("mode-badge");
    badge.textContent = cfg.mode === "live" ? "Live prices" : "Demo prices";
    badge.classList.toggle("mock", cfg.mode !== "live");
    badge.title = cfg.mode === "live" ? "Quotes from Finnhub" : "Offline demo prices. Add a FINNHUB_API_KEY for live quotes.";
  } catch {
    $("mode-badge").textContent = "Offline";
  }
  await refreshQuotes();
}

init();
