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
  Target and B&H exact-SKU first-party PDPs are accepted, with seller identity
  labeled `retailer-owned-pdp-inferred` because the fetched documents did not
  contain offer-scoped seller-of-record evidence.
- Bright Data resolves page access only. It does not override PriceMCP trust
  policy, marketplace seller rejection, staleness, or landed-cost uncertainty.

Source evidence is time-sensitive. Collector runs retain method, timestamp, success/failure, match count, captured offers, and errors. The prototype currently assumes U.S. region, USD, no membership, shipping unknown unless explicitly zero, and tax excluded because it is destination-dependent.

## 2026-09-03 travel and refresh preflight

- Duffel's official Flights API is now implemented as a second credential-gated
  flight source alongside Amadeus. PriceMCP creates an Offer Request, preserves
  baggage and change/refund conditions when returned, and labels non-live Duffel
  offers as synthetic. Documentation: https://duffel.com/docs/api/v2/offer-requests
- The provider fan-out is fail-closed. A failed provider is named in ranking
  evidence when another succeeds; if all configured providers fail, no fare is
  emitted. Production and sandbox offers are not ranked against each other.
- Booking.com Demand API v3.2 and Expedia Rapid Lodging remain the preferred
  maintained accommodation paths. Both require approved credentials/commercial
  access, so stay inventory is contract-ready but not represented as live.
  References: https://developers.booking.com/demand/docs/accommodations/search-for-available-properties
  and https://developers.expediagroup.com/rapid/lodging/shopping/about-shopping-api
- At approximately 03:53 America/New_York, the configured Bright Data path was
  re-run against the four exact AirPods Pro 3 retailer targets. It returned four
  observations, one canonical product match, and zero collection errors across
  Walmart, Target, B&H, and Adorama. Currency was USD; shipping, destination tax,
  and location-dependent delivery remain outside the verified total.

## 2026-09-04 retail catalog access preflight

- Best Buy remains the lowest-friction official retailer catalog. Its Products
  API exposes SKU, price, availability, product attributes, and temporary
  referral URLs after developer-key registration. The existing adapter is ready
  for `BESTBUY_API_KEY`; no key is stored.
  Reference: https://bestbuyapis.github.io/api-documentation/
- Amazon's current supported catalog route is Creators API. It requires Amazon
  Associates enrollment and at least 10 qualifying sales in the preceding 30
  days before API access. It is not a bootstrap source for a new metasearch app.
  Reference: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction
- Walmart says approved affiliates can obtain data feeds in its Affiliate Member
  Center. Its Marketplace and advertising APIs serve separately approved seller
  or advertising use cases and are not interchangeable with affiliate catalog
  rights. Reference: https://affiliates.walmart.com/
- Target routes affiliate publishers through Target Partners/Impact. Catalog
  feed or Impact API access depends on account and campaign approval; Target's
  seller APIs are not a substitute.
- eBay Browse API development starts with developer credentials, but production
  Buy API access and affiliate URLs require eBay review and, for affiliate use,
  eBay Partner Network approval.
  Reference: https://developer.ebay.com/api-docs/buy/static/buy-requirements.html
- Conclusion: no reviewed source provides anonymous, supplier-authorized,
  multi-retailer catalog and live-price access. Best Buy is the only immediate
  self-service API candidate; Amazon, Walmart, Target, and eBay remain gated.
