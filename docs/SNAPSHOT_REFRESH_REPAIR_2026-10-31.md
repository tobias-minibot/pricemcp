# Snapshot refresh repair — local delivery, 2026-10-31

## Result
Local branch `fix/local-snapshot-refresh-20261031`, based on `ace86ff`. Fresh isolated artifact: `artifacts/refresh-20261031/snapshot.db`. No original database overwritten; no push, merge, production deployment, paid service, credentials or configuration changes. Existing restored modifications retained.

## Root cause verified today
Baseline real collection returned Best Buy `success` with **zero** observations. Its Apollo transport now includes `SearchDetailedProduct` wrappers; parser accepted only `SearchProduct`. Detailed wrappers contain full first-party price evidence while ordinary wrappers may contain only fragments. Supporting the detailed wrapper restored 11 observations / 6 successful offers across 8 matched products. Empty transport or wholly unusable fragments now report failure instead of false success. Parser framing also tolerates whitespace before an optional semicolon (the existing regex already accepted no semicolon; do not attribute the outage to that).

The restored, uncommitted verifier made Amazon optional while retaining Apple and Best Buy as required. Preserved and tested that policy; it alone did not fix today's Best Buy schema drift. Historical failure since September 22 is HQ context, not independently confirmed from hosted Actions logs.

## Evidence
Two live collector runs against public sources; no fixture prices used in artifacts. Final run observed 2026-10-31T04:40:09.119–131Z. Export: 39 catalog products, 35 offers/observations, 33 fresh available offers, zero collection runs or decision records. Gate: integrity ok; Apple 26, Best Buy 6, Amazon 1 accepted observations; missingRequired=[], missingOptional=[], unsafe=0.

MacBook Air M5 13-inch 16GB/512GB, US/USD, new:
- Apple $1,299 — https://www.apple.com/shop/buy-mac/macbook-air — official bootstrap, part MDHE4LL/A.
- Best Buy $1,149 — https://www.bestbuy.com/product/apple-macbook-air-13-inch-laptop-m5-chip-with-10-core-cpu-and-8-core-gpu-16gb-memory-512gb-ssd-midnight/JJGCQLKXL7/sku/6397846 — seller 1P, ADD_TO_CART, model MDHE4LL/A.
- Amazon $1,149 — https://www.amazon.com/dp/B0GR1493ZV — sold/shipped by Amazon.com; Sky Blue rather than Midnight.
Prices exclude unknown shipping and destination tax; not a delivered-cost guarantee. Observed timestamps are collector retrieval times, not seller-published change times. `price-evidence.json` retains exact timestamp, URL, title and selected evidence. `bestbuy.html` is local diagnostic capture only: do not publish raw hydration content. Sponsored placement was used only to locate structured seller/variant/price evidence, never as ranking endorsement.

## Changes
- `src/collectors.ts`: detailed wrapper compatibility; empty/ unusable Best Buy evidence becomes explicit failure; harmless framing tolerance.
- `tests/collectors.test.ts`: detailed-wrapper extraction, empty transport and missing-price failure regressions.
- `tests/snapshot-refresh.test.ts`: extended restored tests for pre-run evidence, latest failed run, and stale snapshots.
- Existing `.github/workflows/refresh-snapshot.yml`, `scripts/verify-snapshot-refresh.mjs`, declaration and `tests/providers.test.ts` restored edits preserved, not authored anew. Workflow not executed.

## Verification and reproduction
`npm ci --ignore-scripts --no-audit --no-fund`; `npm run check` passed; `npm test` passed **111/111 tests in 8 files**; `git diff --check` passed. No separate build script exists: TypeScript check plus executable snapshot export and HTTP smoke are the build gates.

```sh
PRICEMCP_DB=./artifacts/refresh-20261031/source.db PRICEMCP_VERCEL_SNAPSHOT=./artifacts/refresh-20261031/snapshot.db PRICEMCP_REFRESH_STARTED_AT=$(cat artifacts/refresh-20261031/started-at.txt) node scripts/verify-snapshot-refresh.mjs
PRICEMCP_DB=./artifacts/refresh-20261031/snapshot.db PRICEMCP_SCHEDULER=false PRICEMCP_COLLECT_ON_START=false HOST=127.0.0.1 PORT=3299 node --import tsx src/server.ts
```
Temporary preview stopped after verification; restart with the command above. Local HTTP GET `/cheap-apples/apple-macbook-air-m5-13-16-512` returned 200; saved HTML `product-page.html`. Browser was running, but first-class navigation to loopback was **blocked by policy**. Did not bypass via alternate browser/CLI. Desktop/mobile visual QA therefore blocked; no screenshot or responsive-layout claim. Production remains unchanged/stale until review, matching approval, deployment and fresh smoke test.

Apple is partial: missing older base M5 MacBook Pro, base M4 iMac, and iPhone 17 Pro bootstrap. Existing Apple catalog selectors do not prove every generation/storage dimension; verified sample has matching Apple/Best Buy part number, but full catalog identity audit remains outstanding. No substitution invented for missing variants. Freshness gate verifies collector and snapshot freshness separately, not full source-to-export row equality. No dependency security audit performed.

## Time and interventions
Child began 04:38:14Z; implementation, fresh export and gate verified by 04:40:27Z; report prepared ~04:41Z. Approximately 3 minutes 30 seconds active elapsed to report (not upstream queue time). Zero human interventions during this child run. Tool friction: unavailable rg, one HTTP/2 fetch failure, shell regex escaping during diagnostics, corrected SQL column name, and browser policy block. No approval requested to bypass these.

## Follow-up 2026-11-16
- Apple colour: equal-price variants were picked by page order (Midnight MDHE4LL/A on 10-31, Sky Blue MDHH4LL/A on 11-03, Silver MDH74LL/A in one 11-16 run). Collector now ranks Midnight, Space Black, Space Gray, Silver, then part number. Regression test added (112 tests).
- Best Buy: SKU 6397846 (Midnight 13in 16/512) no longer appears in any Best Buy search result (checked "apple macbook air" and a SKU-specific query); the page itself is unreachable from this host (HTTP/2 protocol error), so stock/price is unverified. Added the specific query. The $1,149 on 10-31 was not reproduced on 11-03 ($1,299). Reason for the change is unconfirmed (likely a promotion).
- Apple drift is catalog drift, not parser breakage: macbook-pro page now lists only M5 Pro/Max and M6 (no base M5 14in), iMac only 10-core/12-core GPU (no 8-8 M4), and /shop/buy-iphone/iphone-17-pro redirects to /shop/buy-iphone. Those catalog entries correctly stay without a current price; replacing them needs catalog decisions (e.g. M6 14in MacBook Pro), not invented substitutes.
- Amazon B0GR1493ZV is intermittent: selector_drift in some runs, $1,229 in others.
