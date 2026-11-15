// Core planning logic: turn "I have this much cash and this target mix"
// into a concrete list of orders. Pure functions, no I/O, shared by the
// browser and the tests.
//
// A "position" is { symbol, price, shares, target } where target is a
// percentage (any positive scale works: weights are normalised).

const EPS = 1e-9;

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function floorTo(n, dp) {
  const f = 10 ** dp;
  // Small epsilon keeps 2.9999999 from flooring to 2.
  return Math.floor(n * f + 1e-7) / f;
}

export function normaliseWeights(targets) {
  const clean = targets.map((t) => (Number.isFinite(t) && t > 0 ? t : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  return sum > 0 ? clean.map((t) => t / sum) : clean.map(() => 0);
}

// "Water-filling": spend `cash` on the most underweight assets first,
// raising them all to a common level relative to their target, without
// selling anything. Returns the money to put into each asset.
//
// Each active asset i ends at L * w_i, where L is chosen so the total spent
// equals cash. Assets already above L * w_i receive nothing.
export function waterfill(values, weights, cash) {
  const out = values.map(() => 0);
  if (!(cash > EPS)) return out;
  const active = weights.map((_, i) => i).filter((i) => weights[i] > 0);
  if (active.length === 0) return out;
  active.sort((a, b) => values[a] / weights[a] - values[b] / weights[b]);

  let wSum = 0;
  let vSum = 0;
  let level = 0;
  for (let k = 0; k < active.length; k++) {
    const i = active[k];
    wSum += weights[i];
    vSum += values[i];
    level = (cash + vSum) / wSum;
    const nextIdx = active[k + 1];
    const nextBreak = nextIdx === undefined ? Infinity : values[nextIdx] / weights[nextIdx];
    if (level <= nextBreak) break;
  }
  for (const i of active) out[i] = Math.max(0, level * weights[i] - values[i]);
  return out;
}

function validPositions(positions) {
  return positions.map((p) => ({
    symbol: String(p.symbol),
    price: Number(p.price) > 0 ? Number(p.price) : 0,
    shares: Number(p.shares) > 0 ? Number(p.shares) : 0,
    target: Number(p.target) > 0 ? Number(p.target) : 0,
  }));
}

function summariseAfter(pos, weights, deltaShares) {
  const values = pos.map((p, i) => (p.shares + deltaShares[i]) * p.price);
  const total = values.reduce((a, b) => a + b, 0);
  return pos.map((p, i) => ({
    symbol: p.symbol,
    shares: round(p.shares + deltaShares[i], 6),
    value: round(values[i], 2),
    weight: total > 0 ? values[i] / total : 0,
    target: weights[i],
  }));
}

/**
 * Plan how to invest new cash without selling anything.
 *
 * options:
 *   fractional  - allow fractional shares (4 dp). Default false (whole shares).
 *   minOrder    - skip any order smaller than this amount. Default 0.
 *   feePerOrder - flat commission per order; reserved from the cash. Default 0.
 */
export function planInvest(positions, cash, options = {}) {
  const { fractional = false, minOrder = 0, feePerOrder = 0 } = options;
  const pos = validPositions(positions);
  const weights = normaliseWeights(pos.map((p) => p.target));
  const values = pos.map((p) => p.shares * p.price);
  const skipped = new Map();

  for (let i = 0; i < pos.length; i++) {
    if (weights[i] > 0 && pos[i].price <= 0) skipped.set(pos[i].symbol, "no price available");
  }

  cash = Number(cash) > 0 ? Number(cash) : 0;
  let reservedOrders = 0;
  let result = null;

  for (let iter = 0; iter < 2 * pos.length + 4; iter++) {
    const budget = cash - reservedOrders * feePerOrder;
    const w = weights.map((wi, i) => (skipped.has(pos[i].symbol) ? 0 : wi));
    const delta = pos.map(() => 0);
    let spent = 0;

    if (budget > EPS) {
      const money = waterfill(values, w, budget);
      for (let i = 0; i < pos.length; i++) {
        if (money[i] <= EPS || pos[i].price <= 0) continue;
        delta[i] = fractional ? floorTo(money[i] / pos[i].price, 4) : Math.floor(money[i] / pos[i].price + 1e-9);
        spent += delta[i] * pos[i].price;
      }

      // Whole shares leave cash over: keep buying one share of whichever
      // affordable asset is furthest below its target.
      if (!fractional) {
        const totalAfter = values.reduce((a, b) => a + b, 0) + budget;
        for (let guard = 0; guard < 100000; guard++) {
          const left = budget - spent;
          let best = -1;
          let bestGap = 0;
          for (let i = 0; i < pos.length; i++) {
            if (w[i] <= 0 || pos[i].price <= 0 || pos[i].price > left + EPS) continue;
            // Buying a new name would cost another commission.
            if (feePerOrder > 0 && delta[i] === 0) continue;
            const gap = w[i] * totalAfter - (values[i] + delta[i] * pos[i].price);
            if (gap > bestGap) {
              bestGap = gap;
              best = i;
            }
          }
          if (best < 0) break;
          delta[best] += 1;
          spent += pos[best].price;
        }
      }
    }

    const orders = [];
    let tooSmall = false;
    for (let i = 0; i < pos.length; i++) {
      if (delta[i] <= 0) continue;
      const amount = delta[i] * pos[i].price;
      if (minOrder > 0 && amount < minOrder - EPS) {
        skipped.set(pos[i].symbol, `order below minimum (${round(amount, 2)})`);
        tooSmall = true;
        continue;
      }
      orders.push({ side: "BUY", symbol: pos[i].symbol, shares: delta[i], price: pos[i].price, amount: round(amount, 2) });
    }

    if (tooSmall) continue; // re-solve without the tiny orders
    if (orders.length > reservedOrders && feePerOrder > 0) {
      reservedOrders = orders.length;
      continue; // re-solve with enough cash held back for commissions
    }

    const finalDelta = pos.map((p) => {
      const o = orders.find((x) => x.symbol === p.symbol);
      return o ? o.shares : 0;
    });
    const fees = orders.length * feePerOrder;
    const total = orders.reduce((a, o) => a + o.shares * o.price, 0);
    result = {
      orders,
      spent: round(total, 2),
      fees: round(fees, 2),
      leftover: round(Math.max(0, cash - total - fees), 2),
      after: summariseAfter(pos, weights, finalDelta),
      skipped: [...skipped].map(([symbol, reason]) => ({ symbol, reason })),
    };
    break;
  }

  return (
    result || {
      orders: [],
      spent: 0,
      fees: 0,
      leftover: round(cash, 2),
      after: summariseAfter(pos, weights, pos.map(() => 0)),
      skipped: [...skipped].map(([symbol, reason]) => ({ symbol, reason })),
    }
  );
}

/**
 * Full rebalance: buy AND sell so every holding lands on its target,
 * using current holdings plus any new cash. Trades smaller than minOrder
 * are skipped (that's your drift tolerance).
 */
export function planRebalance(positions, cash, options = {}) {
  const { fractional = false, minOrder = 0, feePerOrder = 0 } = options;
  const pos = validPositions(positions);
  const weights = normaliseWeights(pos.map((p) => p.target));
  const values = pos.map((p) => p.shares * p.price);
  cash = Number(cash) > 0 ? Number(cash) : 0;
  const total = values.reduce((a, b) => a + b, 0) + cash;
  const skipped = [];
  for (let i = 0; i < pos.length; i++) {
    if (pos[i].price <= 0) skipped.push({ symbol: pos[i].symbol, reason: "no price available" });
  }

  let reserved = 0;
  let delta = pos.map(() => 0);
  let orders = [];
  for (let iter = 0; iter < pos.length + 2; iter++) {
    const investable = Math.max(0, total - reserved * feePerOrder);
    delta = pos.map((p, i) => {
      if (p.price <= 0) return 0;
      const targetShares = (weights[i] * investable) / p.price;
      // Nearest whole share avoids churn trades caused purely by rounding;
      // any resulting overspend is trimmed from the buys below.
      const want = fractional ? floorTo(targetShares, 4) : Math.round(targetShares);
      const d = round(want - p.shares, 6);
      if (Math.abs(d * p.price) < Math.max(minOrder, 0.005)) return 0;
      return d;
    });

    // Skipped small sells mean less cash than planned: trim buys to fit.
    const nTrades = delta.filter((d) => d !== 0).length;
    const available = cash + pos.reduce((a, p, i) => a + (delta[i] < 0 ? -delta[i] * p.price : 0), 0) - nTrades * feePerOrder;
    let buyCost = pos.reduce((a, p, i) => a + (delta[i] > 0 ? delta[i] * p.price : 0), 0);
    if (buyCost > available + EPS) {
      if (fractional) {
        const k = Math.max(0, available) / buyCost;
        delta = delta.map((d) => (d > 0 ? floorTo(d * k, 4) : d));
      } else {
        while (buyCost > available + EPS) {
          let best = -1;
          for (let i = 0; i < pos.length; i++) {
            if (delta[i] >= 1 && (best < 0 || delta[i] * pos[i].price > delta[best] * pos[best].price)) best = i;
          }
          if (best < 0) break;
          delta[best] -= 1;
          buyCost -= pos[best].price;
        }
      }
      delta = delta.map((d, i) => (d > 0 && d * pos[i].price < minOrder - EPS ? 0 : d));
    }

    orders = [];
    pos.forEach((p, i) => {
      if (delta[i] === 0) return;
      orders.push({
        side: delta[i] > 0 ? "BUY" : "SELL",
        symbol: p.symbol,
        shares: Math.abs(delta[i]),
        price: p.price,
        amount: round(Math.abs(delta[i]) * p.price, 2),
      });
    });
    if (feePerOrder > 0 && orders.length > reserved) {
      reserved = orders.length;
      continue;
    }
    break;
  }

  // Sells first, so their proceeds fund the buys.
  orders.sort((a, b) => (a.side === b.side ? b.amount - a.amount : a.side === "SELL" ? -1 : 1));
  const buys = orders.filter((o) => o.side === "BUY").reduce((a, o) => a + o.amount, 0);
  const sells = orders.filter((o) => o.side === "SELL").reduce((a, o) => a + o.amount, 0);
  const fees = orders.length * feePerOrder;
  return {
    orders,
    spent: round(buys, 2),
    proceeds: round(sells, 2),
    fees: round(fees, 2),
    leftover: round(Math.max(0, cash + sells - buys - fees), 2),
    after: summariseAfter(pos, weights, delta),
    skipped,
  };
}

/** Current value and drift from target for each position. */
export function portfolioSummary(positions) {
  const pos = validPositions(positions);
  const weights = normaliseWeights(pos.map((p) => p.target));
  const values = pos.map((p) => p.shares * p.price);
  const total = values.reduce((a, b) => a + b, 0);
  const rows = pos.map((p, i) => {
    const weight = total > 0 ? values[i] / total : 0;
    return { symbol: p.symbol, value: values[i], weight, target: weights[i], drift: weight - weights[i] };
  });
  const maxDrift = rows.reduce((m, r) => Math.max(m, Math.abs(r.drift)), 0);
  return { total, rows, maxDrift };
}

/** Weighted-average expense ratio of a target mix (expenseRatios as fractions). */
export function blendedExpenseRatio(targets, expenseRatios) {
  const w = normaliseWeights(targets);
  return w.reduce((a, wi, i) => a + wi * (Number(expenseRatios[i]) || 0), 0);
}

/**
 * Project growth with a starting balance and monthly contributions.
 * Returns one point per year (year 0 = today).
 */
export function projectGrowth({ start = 0, monthly = 0, years = 10, annualReturn = 0.06, expenseRatio = 0 }) {
  const months = Math.max(0, Math.round(years * 12));
  const net = (1 + annualReturn - expenseRatio) ** (1 / 12) - 1;
  const gross = (1 + annualReturn) ** (1 / 12) - 1;
  let value = start;
  let valueNoFees = start;
  let contributed = start;
  const points = [{ year: 0, contributed, value, valueNoFees }];
  for (let m = 1; m <= months; m++) {
    value = value * (1 + net) + monthly;
    valueNoFees = valueNoFees * (1 + gross) + monthly;
    contributed += monthly;
    if (m % 12 === 0 || m === months) {
      points.push({ year: round(m / 12, 2), contributed, value, valueNoFees });
    }
  }
  return points;
}
