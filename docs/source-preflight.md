# Source and tooling preflight — 2026-08-28

Before custom collection, PriceMCP checked maintained primitives and stable seller-owned data paths.

- Official public commerce APIs: no anonymous Apple/Best Buy retail price API was available for this scope. Best Buy's historical developer API requires credentials; none were supplied.
- Public structured data: Apple product-selection bootstrap and Best Buy Apollo SSR state contain the required seller-owned product/price fields and were preferred over DOM scraping.
- Existing maintained libraries: official `@modelcontextprotocol/sdk`, Fastify, Cheerio, Zod, Croner, and Node's built-in `node:sqlite` cover protocol, HTTP, parsing, validation, scheduling, and persistence. A scraper framework/browser farm would add cost without improving this curated V1.
- Browser automation: not required for the three implemented adapters and intentionally not used to evade challenges.
- Rejected/blocked paths: Walmart challenge; Costco/B&H/Adorama/Abt access denial; Target client shell; Amazon search-page seller ambiguity. Amazon exact product pages are accepted only when the primary new-condition buy box explicitly says `Sold by Amazon.com`.

## 2026-08-29 maintained-source preflight

- Best Buy's official Products API remains the preferred supported path for catalog, price, and availability. PriceMCP now uses it automatically when `BESTBUY_API_KEY` is configured; the key is never stored in the repository.
- Walmart's supported price/catalog access requires an approved affiliate/API relationship and its terms restrict scraping and price-alert behavior. No Walmart collector was added.
- Micro Center does not publish a product/price/inventory API. No unsupported endpoint or blind scraper was added.
- Existing Best Buy embedded-data collection remains isolated as prototype continuity only. Saved contract fixtures, SLA state, schema-drift detection, and an optional failure webhook now make breakage visible.

## 2026-08-29 Bright Data hackathon path

- Bright Data MCP is the maintained hackathon access layer for retailer pages
  that direct requests could not retrieve reliably.
- PriceMCP verified the identical AirPods Pro 3 MFHP4LL/A / UPC 195950543698
  across Walmart, Target, B&H, and Adorama. Saved HTML/Markdown repair rules
  handle page-shape changes, while seller allowlists, exact retailer identifiers,
  availability evidence, and canonical product matching remain fail-closed.
  Target and B&H observations are retained but quarantined because the fetched
  documents did not contain offer-scoped seller-of-record evidence.
- Bright Data resolves page access only. It does not override PriceMCP trust
  policy, marketplace seller rejection, staleness, or landed-cost uncertainty.

Source evidence is time-sensitive. Collector runs retain method, timestamp, success/failure, match count, captured offers, and errors. The prototype currently assumes U.S. region, USD, no membership, shipping unknown unless explicitly zero, and tax excluded because it is destination-dependent.
