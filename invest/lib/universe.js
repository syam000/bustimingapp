// Built-in list of popular ETFs and stocks. Used for search, for mock prices
// when no API key is configured, and for metadata (expense ratio, category)
// that quote APIs don't return. Shared by the server and the browser, so it
// must stay free of Node-only imports.
//
// mockPrice values are rough reference levels for offline demo mode only.
// They are NOT live prices.

export const UNIVERSE = [
  // Broad, globally diversified ETFs
  { symbol: "VT", name: "Vanguard Total World Stock ETF", type: "ETF", category: "Global equity", expenseRatio: 0.0006, mockPrice: 128 },
  { symbol: "VWRA", name: "Vanguard FTSE All-World UCITS ETF (Acc)", type: "ETF", category: "Global equity", expenseRatio: 0.0019, mockPrice: 148, exchange: "LSE", liveSymbol: "VWRA.L", note: "Ireland-domiciled: lower US dividend withholding (15%) for many non-US investors" },
  { symbol: "IWDA", name: "iShares Core MSCI World UCITS ETF (Acc)", type: "ETF", category: "Developed equity", expenseRatio: 0.002, mockPrice: 108, exchange: "LSE", liveSymbol: "IWDA.L", note: "Ireland-domiciled" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", type: "ETF", category: "US equity", expenseRatio: 0.0003, mockPrice: 300 },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "ETF", category: "US equity", expenseRatio: 0.0003, mockPrice: 540 },
  { symbol: "CSPX", name: "iShares Core S&P 500 UCITS ETF (Acc)", type: "ETF", category: "US equity", expenseRatio: 0.0007, mockPrice: 620, exchange: "LSE", liveSymbol: "CSPX.L", note: "Ireland-domiciled" },
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100)", type: "ETF", category: "US growth", expenseRatio: 0.002, mockPrice: 510 },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", type: "ETF", category: "International equity", expenseRatio: 0.0005, mockPrice: 66 },
  { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF", type: "ETF", category: "Emerging markets", expenseRatio: 0.0008, mockPrice: 46 },
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF", type: "ETF", category: "US dividend", expenseRatio: 0.0006, mockPrice: 28 },
  { symbol: "VNQ", name: "Vanguard Real Estate ETF", type: "ETF", category: "Real estate", expenseRatio: 0.0013, mockPrice: 92 },
  // Bonds & cash-like
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", type: "ETF", category: "US bonds", expenseRatio: 0.0003, mockPrice: 73 },
  { symbol: "AGGU", name: "iShares Core Global Aggregate Bond UCITS ETF (USD Hedged, Acc)", type: "ETF", category: "Global bonds", expenseRatio: 0.001, mockPrice: 5.6, exchange: "LSE", liveSymbol: "AGGU.L", note: "Ireland-domiciled" },
  { symbol: "BNDX", name: "Vanguard Total International Bond ETF", type: "ETF", category: "International bonds", expenseRatio: 0.0007, mockPrice: 49 },
  { symbol: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", type: "ETF", category: "Cash / T-bills", expenseRatio: 0.0009, mockPrice: 100.5 },
  { symbol: "GLD", name: "SPDR Gold Shares", type: "ETF", category: "Gold", expenseRatio: 0.004, mockPrice: 240 },
  // Large-cap stocks
  { symbol: "AAPL", name: "Apple Inc.", type: "Stock", category: "Technology", expenseRatio: 0, mockPrice: 225 },
  { symbol: "MSFT", name: "Microsoft Corp.", type: "Stock", category: "Technology", expenseRatio: 0, mockPrice: 420 },
  { symbol: "NVDA", name: "NVIDIA Corp.", type: "Stock", category: "Technology", expenseRatio: 0, mockPrice: 135 },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)", type: "Stock", category: "Communication", expenseRatio: 0, mockPrice: 170 },
  { symbol: "AMZN", name: "Amazon.com Inc.", type: "Stock", category: "Consumer", expenseRatio: 0, mockPrice: 190 },
  { symbol: "META", name: "Meta Platforms Inc.", type: "Stock", category: "Communication", expenseRatio: 0, mockPrice: 560 },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc. (Class B)", type: "Stock", category: "Financials", expenseRatio: 0, mockPrice: 460 },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", type: "Stock", category: "Financials", expenseRatio: 0, mockPrice: 220 },
  { symbol: "V", name: "Visa Inc.", type: "Stock", category: "Financials", expenseRatio: 0, mockPrice: 290 },
  { symbol: "JNJ", name: "Johnson & Johnson", type: "Stock", category: "Healthcare", expenseRatio: 0, mockPrice: 155 },
  { symbol: "KO", name: "The Coca-Cola Company", type: "Stock", category: "Consumer staples", expenseRatio: 0, mockPrice: 68 },
  { symbol: "TSM", name: "Taiwan Semiconductor (ADR)", type: "Stock", category: "Technology", expenseRatio: 0, mockPrice: 185 },
];

const BY_SYMBOL = new Map(UNIVERSE.map((i) => [i.symbol, i]));

export function getInstrument(symbol) {
  return BY_SYMBOL.get(String(symbol || "").toUpperCase()) || null;
}

export function searchUniverse(query, limit = 15) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return UNIVERSE.slice(0, limit);
  const scored = [];
  for (const inst of UNIVERSE) {
    const sym = inst.symbol.toLowerCase();
    const hay = `${inst.name} ${inst.category} ${inst.type}`.toLowerCase();
    let score = -1;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 1;
    else if (hay.includes(q)) score = 2;
    if (score >= 0) scored.push({ inst, score });
  }
  scored.sort((a, b) => a.score - b.score || a.inst.symbol.localeCompare(b.inst.symbol));
  return scored.slice(0, limit).map((s) => s.inst);
}

// Ready-made starting points. Weights are percentages.
export const MODEL_PORTFOLIOS = [
  {
    id: "one-fund",
    name: "One-fund world",
    blurb: "The whole global stock market in a single ETF. Simplest possible start.",
    risk: "Higher",
    holdings: [{ symbol: "VWRA", target: 100 }],
  },
  {
    id: "three-fund",
    name: "Classic three-fund",
    blurb: "US stocks, international stocks and bonds: cheap, diversified, easy to rebalance.",
    risk: "Medium-high",
    holdings: [
      { symbol: "VTI", target: 55 },
      { symbol: "VXUS", target: 30 },
      { symbol: "BND", target: 15 },
    ],
  },
  {
    id: "balanced",
    name: "Balanced 60/40",
    blurb: "60% global stocks and 40% bonds, for smaller swings.",
    risk: "Medium",
    holdings: [
      { symbol: "VWRA", target: 60 },
      { symbol: "AGGU", target: 40 },
    ],
  },
  {
    id: "core-satellite",
    name: "Core + a few stocks",
    blurb: "A diversified ETF core with a small slice for individual companies you believe in.",
    risk: "Higher",
    holdings: [
      { symbol: "VWRA", target: 70 },
      { symbol: "MSFT", target: 10 },
      { symbol: "NVDA", target: 10 },
      { symbol: "BND", target: 10 },
    ],
  },
];
