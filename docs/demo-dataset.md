# PriceMCP synthetic demo dataset

`pricemcp-demo-v1` is a controlled interface and ranking benchmark. It is not a
price source. Product identities are realistic canonical examples; prices,
merchants, availability, timestamps, history, and evidence URLs are synthetic.

## Isolation and provenance

- Database: `data/pricemcp-demo.db` (separate from `data/pricemcp.db`)
- Product and observation fields: `dataset: "pricemcp-demo-v1"`, `synthetic: true`
- Evidence URLs: `https://example.invalid/...`
- Web warning: persistent `DEMO DATA — SYNTHETIC PRICES — NOT LIVE OR PURCHASABLE`
- Scheduler: disabled; the dataset regenerates on demo-service start, or explicitly
  with `npm run demo:seed`, so freshness scenarios remain controlled.

## Catalog (31 canonical products)

- Electronics (13): MacBook Air, MacBook Pro, Mac mini M4/M5/M6, iPhone 17 Pro, iPad Pro,
  Apple Watch, AirPods Pro, Sony WH-1000XM6, Nintendo Switch 2, Kindle
  Paperwhite, and Samsung 990 PRO 2TB.
- Household/pack size (6): Tide PODS, Bounty rolls, Duracell AA batteries,
  Brita filters, Purina dog food, and Huggies diapers.
- Appliances/tools (5): Dyson V15, KitchenAid KSM150PSER, Instant Pot Duo,
  Brother HL-L2460DW, and DeWalt DCD771C2.
- Edition-sensitive goods (3): LEGO 10307, Zelda: Tears of the Kingdom physical
  edition, and Catan 5th Edition.
- Personal care/OTC (4): CeraVe lotion, Advil, Oral-B brush heads, and Gillette
  cartridges.

## Offer scenarios per product

1. `Brand Direct`: synthetic official reference, trust 1.00.
2. `Northstar Retail`: best unconditional trusted offer plus six history points.
3. `Club Warehouse`: lower trusted price that requires membership.
4. `MarketSquare Seller`: lowest headline price but unresolved marketplace seller.
5. `Outlet Depot`: unavailable offer.
6. `Harbor Electronics`: stale offer older than 24 hours.

The generated multipliers are deterministic relative to each product's synthetic
official reference: Northstar 89%, member 86%, marketplace 80%, unavailable 78%,
and stale 75%. These percentages are test fixtures, not market estimates.

## Expected ranking behavior

- `cheapest_offer`: MarketSquare (untrusted marketplace).
- `best_trusted_offer`: Northstar (fresh, unconditional, authorized).
- `best_membership_offer`: Club Warehouse (trusted but conditional).
- `official_price`: Brand Direct.
- `find_best_offer` excludes membership offers unless `include_membership: true`.
- Stale and unavailable offers remain visible but cannot win a current ranking.
