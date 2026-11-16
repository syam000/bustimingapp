# EasyInvest

A small, dependency-free web app that makes investing in ETFs and stocks
easier. You pick a target mix, enter how much you want to invest, and it
gives you the exact orders to place with your broker.

> Planning tool only: it does **not** place trades or hold money, and it is
> not financial advice.

## What it does

1. **Target mix.** Start from a model portfolio (one-fund world, classic
   three-fund, 60/40, core + a few stocks) or search for any ETF or stock.
   Enter the shares you already own.
2. **Invest.** Enter an amount and get an order list:
   - **Buy only** (default): new money goes to whatever is most below its
     target first ("water-filling"), so you rebalance without ever selling.
   - **Full rebalance**: buys *and* sells to land every holding on target.
     Sells are listed first so their proceeds fund the buys.
   - Whole or fractional shares, a per-order broker fee (held back from your
     cash), and a minimum order size to skip tiny trades.
   - Copy the list, download it as CSV, or click **I placed these orders** to
     update your holdings and activity log.
3. **Make it a habit.** Project monthly investing over 1–40 years, including
   what the funds' expense ratios cost you along the way.

Everything is saved in your browser's `localStorage`. Nothing leaves your
machine except ticker symbols sent to the quote API.

## Quick start (offline demo prices)

```bash
cd invest
npm start
```

Open http://localhost:3100. No API key needed: prices are deterministic
**demo prices**, labelled as such in the header.

## Live prices

1. Get a free key at https://finnhub.io/register
2. `cp .env.example .env` and set `FINNHUB_API_KEY=<your key>`
3. `npm start`. The badge now says **Live prices**.

The key stays on the server. Symbols Finnhub's free tier doesn't cover (e.g.
some London-listed UCITS ETFs like `VWRA`) fall back to an estimate marked
**EST**. Force demo mode at any time with `npm run mock`.

## Layout

```
server.js          HTTP server: /api/config, /api/quotes, /api/search, static files
lib/allocate.js    planning maths (pure; shared with the browser)
lib/universe.js    built-in ETF/stock list and model portfolios (shared)
lib/quotes.js      mock quotes + Finnhub client (server only)
public/            UI (vanilla HTML/CSS/JS)
test/              node:test unit tests: npm test
```

## Ideas for next steps

- Multi-currency (e.g. SGD-listed ETFs such as ES3) with FX conversion.
- Recurring-investment reminders.
- Broker integration to place orders directly (e.g. Alpaca or Interactive
  Brokers APIs). This needs accounts, auth and much more care.
