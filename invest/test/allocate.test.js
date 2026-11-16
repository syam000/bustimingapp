import { test } from "node:test";
import assert from "node:assert/strict";
import { waterfill, planInvest, planRebalance, projectGrowth, blendedExpenseRatio, portfolioSummary } from "../lib/allocate.js";
import { getMockQuote, getLiveQuote } from "../lib/quotes.js";
import { searchUniverse, MODEL_PORTFOLIOS, getInstrument } from "../lib/universe.js";

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

test("waterfill from empty portfolio splits cash by weight", () => {
  const out = waterfill([0, 0, 0], [0.6, 0.3, 0.1], 1000);
  assert.deepEqual(out.map((x) => Math.round(x)), [600, 300, 100]);
});

test("waterfill tops up the underweight asset first and never sells", () => {
  // 50/50 target, A=900 B=100. 400 new cash should all go to B.
  const out = waterfill([900, 100], [0.5, 0.5], 400);
  assert.equal(Math.round(out[0]), 0);
  assert.equal(Math.round(out[1]), 400);
  // With enough cash, both end on target.
  const big = waterfill([900, 100], [0.5, 0.5], 2000);
  assert.equal(Math.round(900 + big[0]), Math.round(100 + big[1]));
  assert.equal(Math.round(sum(big)), 2000);
});

test("planInvest with whole shares never overspends and uses leftover cash", () => {
  const positions = [
    { symbol: "VTI", price: 300, shares: 0, target: 60 },
    { symbol: "VXUS", price: 66, shares: 0, target: 30 },
    { symbol: "BND", price: 73, shares: 0, target: 10 },
  ];
  const plan = planInvest(positions, 1000);
  assert.ok(plan.spent <= 1000);
  assert.ok(plan.leftover < 66, `leftover ${plan.leftover} should be less than cheapest price`);
  assert.equal(Math.round((plan.spent + plan.leftover) * 100), 100000);
  for (const o of plan.orders) assert.ok(Number.isInteger(o.shares));
});

test("planInvest fractional shares spends almost everything on target", () => {
  const positions = [
    { symbol: "A", price: 333.33, shares: 0, target: 70 },
    { symbol: "B", price: 47.1, shares: 0, target: 30 },
  ];
  const plan = planInvest(positions, 500, { fractional: true });
  assert.ok(plan.leftover < 0.1);
  const a = plan.after.find((x) => x.symbol === "A");
  assert.ok(Math.abs(a.weight - 0.7) < 0.001);
});

test("planInvest skips orders below the minimum and reserves fees", () => {
  const positions = [
    { symbol: "BIG", price: 10, shares: 0, target: 95 },
    { symbol: "TINY", price: 10, shares: 0, target: 5 },
  ];
  const plan = planInvest(positions, 400, { minOrder: 50, feePerOrder: 2 });
  assert.deepEqual(plan.orders.map((o) => o.symbol), ["BIG"]);
  assert.equal(plan.fees, 2);
  assert.ok(plan.spent + plan.fees <= 400);
  assert.ok(plan.skipped.some((s) => s.symbol === "TINY"));
});

test("planInvest reports symbols with no price instead of crashing", () => {
  const plan = planInvest([{ symbol: "X", price: 0, shares: 0, target: 100 }], 100);
  assert.equal(plan.orders.length, 0);
  assert.equal(plan.leftover, 100);
  assert.equal(plan.skipped[0].symbol, "X");
});

test("planRebalance sells overweight, buys underweight, sells listed first", () => {
  const positions = [
    { symbol: "STOCK", price: 100, shares: 80, target: 50 },
    { symbol: "BOND", price: 100, shares: 20, target: 50 },
  ];
  const plan = planRebalance(positions, 0);
  assert.equal(plan.orders[0].side, "SELL");
  assert.deepEqual(
    plan.orders.map((o) => [o.side, o.symbol, o.shares]),
    [["SELL", "STOCK", 30], ["BUY", "BOND", 30]]
  );
  assert.ok(plan.spent <= plan.proceeds);
});

test("planRebalance never spends more than it has when small sells are skipped", () => {
  const positions = [
    { symbol: "A", price: 10, shares: 52, target: 50 },
    { symbol: "B", price: 10, shares: 48, target: 50 },
  ];
  // Selling 2 A (=20) is below minOrder, so the 2 B buy can't be funded.
  const plan = planRebalance(positions, 0, { minOrder: 25 });
  assert.ok(plan.spent <= plan.proceeds + 0.001);
});

test("portfolioSummary computes drift", () => {
  const s = portfolioSummary([
    { symbol: "A", price: 1, shares: 70, target: 50 },
    { symbol: "B", price: 1, shares: 30, target: 50 },
  ]);
  assert.equal(s.total, 100);
  assert.ok(Math.abs(s.maxDrift - 0.2) < 1e-9);
});

test("projectGrowth compounds contributions and shows fee drag", () => {
  const pts = projectGrowth({ start: 0, monthly: 100, years: 10, annualReturn: 0.07, expenseRatio: 0.01 });
  assert.equal(pts.length, 11);
  const last = pts.at(-1);
  assert.equal(last.contributed, 12000);
  assert.ok(last.value > last.contributed);
  assert.ok(last.valueNoFees > last.value);
});

test("blendedExpenseRatio is weight-averaged", () => {
  assert.ok(Math.abs(blendedExpenseRatio([50, 50], [0.001, 0.003]) - 0.002) < 1e-12);
});

test("mock quotes are deterministic and positive", () => {
  const now = new Date("2026-01-05T10:00:00Z");
  const a = getMockQuote("VOO", now);
  assert.equal(a.price, getMockQuote("voo", now).price);
  assert.ok(a.price > 0 && a.known);
  assert.ok(getMockQuote("ZZZZ", now).price > 0);
});

test("live quote maps Finnhub response and LSE symbols", async () => {
  let calledUrl = "";
  const fakeFetch = async (url) => {
    calledUrl = url;
    return { ok: true, status: 200, json: async () => ({ c: 150.5, pc: 149 }) };
  };
  const q = await getLiveQuote("k", "VWRA", fakeFetch);
  assert.match(calledUrl, /symbol=VWRA\.L/);
  assert.equal(q.price, 150.5);
  assert.equal(q.source, "live");
  const none = await getLiveQuote("k", "NOPE", async () => ({ ok: true, status: 200, json: async () => ({ c: 0 }) }));
  assert.equal(none, null);
});

test("universe search and model portfolios are consistent", () => {
  assert.equal(searchUniverse("voo")[0].symbol, "VOO");
  assert.ok(searchUniverse("bond").length > 0);
  for (const m of MODEL_PORTFOLIOS) {
    assert.equal(sum(m.holdings.map((h) => h.target)), 100, m.id);
    for (const h of m.holdings) assert.ok(getInstrument(h.symbol), h.symbol);
  }
});

test("planRebalance does not churn when holdings are already on target up to rounding", () => {
  const positions = [
    { symbol: "VTI", price: 303.92, shares: 10, target: 55 },
    { symbol: "VXUS", price: 67.38, shares: 24, target: 30 },
    { symbol: "BND", price: 71.01, shares: 12, target: 15 },
  ];
  const plan = planRebalance(positions, 0);
  assert.equal(plan.orders.length, 0, JSON.stringify(plan.orders));
});

test("planRebalance with whole shares never spends more than cash plus sells", () => {
  for (let seed = 1; seed < 200; seed++) {
    const r = (n) => ((Math.sin(seed * n) + 1) / 2);
    const positions = [0, 1, 2, 3].map((i) => ({ symbol: `S${i}`, price: 5 + r(i + 1) * 400, shares: Math.floor(r(i + 7) * 30), target: 1 + r(i + 13) * 50 }));
    const cash = r(99) * 3000;
    const plan = planRebalance(positions, cash, { feePerOrder: seed % 3 });
    assert.ok(plan.spent + plan.fees <= cash + plan.proceeds + 0.01, `seed ${seed}`);
  }
});

test("planInvest never overspends across random portfolios", () => {
  for (let seed = 1; seed < 200; seed++) {
    const r = (n) => ((Math.sin(seed * n * 1.3) + 1) / 2);
    const positions = [0, 1, 2].map((i) => ({ symbol: `S${i}`, price: 1 + r(i + 1) * 500, shares: Math.floor(r(i + 5) * 20), target: r(i + 9) * 60 }));
    const cash = r(77) * 5000;
    const plan = planInvest(positions, cash, { feePerOrder: seed % 4, minOrder: seed % 5 === 0 ? 100 : 0, fractional: seed % 2 === 0 });
    assert.ok(plan.spent + plan.fees <= cash + 0.01, `seed ${seed}`);
  }
});
