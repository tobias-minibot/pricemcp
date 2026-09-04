# PriceMCP product program

PriceMCP Core remains the neutral MCP evidence layer. PriceMCP Companion is a
separate consumer client that proves what can be built on that layer. Ranking
policy never accepts advertising, affiliate payout, or membership economics as
an input.

## Core catalog

The catalog is a set of canonical subject contracts, not a list of search
keywords. The executable contract is published by the read-only `list_catalog`
MCP tool and `GET /v1/catalog`; implementation state is explicit for every
category.

1. **Flights:** itinerary, passengers, cabin, fare brand, bags, stops,
   refund/change rules, complete total, expiry, and booking handoff.
2. **Stays:** property, room and bed type, occupancy, dates, meal plan,
   cancellation window, taxes, resort/property fees, deposit, and pay-now versus
   pay-later basis.
3. **Rental cars:** pickup/drop-off, vehicle class, mileage, fuel policy,
   insurance basis, deposit, driver constraints, and complete total.
4. **Activities and transfers:** exact session or route, participants,
   cancellation terms, inclusions, accessibility, and complete total.
5. **Retail products:** exact variant, seller of record, condition, membership,
   shipping, tax basis, stock, freshness, and returns. Apple remains the first
   controlled product wedge.

## Competitive usefulness

Booking.com sets the breadth baseline: stays, flights, cars, activities,
transfers, trip management, loyalty, and support. Super.com sets the hotel-value
baseline: member rates, cashback, fee disclosure, confirmations, cancellation,
and support.

PriceMCP should not imitate both feature-for-feature before it has inventory.
Its defensible first advantage is decision quality:

- exact comparable offers rather than mixed room, fare, or product variants;
- total-cost and conditional-price disclosure before ranking;
- a visible explanation of why the winner wins and why cheaper headlines lose;
- constraint changes that re-run the comparison instead of hiding trade-offs;
- provenance, freshness, and confidence available to both person and agent;
- neutral ranking with checkout handoff only after human review.

## Delivery stages

- **Stage 0 — proof:** polished Companion discovery UI over disclosed synthetic
  inventory; booking controls disabled.
- **Stage 1 — live discovery:** at least two authorized flight sources and two
  authorized stay sources, normalized behind the same evidence contract.
- **Stage 2 — booking handoff:** provider deep links, saved shortlists, shareable
  plans, price-change checks, and explicit confirmation.
- **Stage 3 — transaction:** only after provider contracts, payment/PII controls,
  cancellation workflows, support ownership, and regulatory review.

## Source acquisition order

1. Complete authorized production credentials for the Amadeus flight path.
2. Complete authorized Duffel access for the implemented second-source adapter,
   making comparison real rather than single-provider ranking.
3. Apply for hotel inventory through Expedia Rapid and Booking.com Demand API;
   treat approval and commercial terms as dependencies, not assumed access.
   The provider-ready application brief, unresolved applicant fields, and
   search/handoff design are tracked in
   [`STAY_PARTNER_READINESS.md`](./STAY_PARTNER_READINESS.md).
4. Add non-price destination context only from maintained public sources; never
   present weather or editorial content as price evidence.
5. Keep Bright Data restricted to retailer evidence where direct or supported
   APIs are inadequate and collection terms permit the target.

## Success measures

- percentage of searches with two or more comparable authorized sources;
- percentage of totals with all mandatory fees represented;
- stale/conditional/mismatched offers excluded before ranking;
- booking-handoff click-through after evidence review;
- price-change rate between shortlist and handoff;
- user corrections required per canonical subject;
- zero synthetic or test offers presented as live.
