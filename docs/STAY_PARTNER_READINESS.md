# Stay provider partner-readiness package

Status: prepared September 4, 2026; applications not submitted.

PriceMCP needs approved commercial access before it can represent Expedia Rapid
or Booking.com Demand inventory as live. This package keeps the initial request
to live accommodation shopping and provider handoff. It does not request
payments, order creation, or in-app booking.

## Product brief

**Product:** PriceMCP Companion and PriceMCP Core

**Public product:** https://pricemcp.vercel.app/companion

**Public implementation:** https://github.com/tobias-minibot/pricemcp

**Current state:** Public, non-bookable flight discovery using clearly labeled
Duffel sandbox inventory. The stay contract is published but no stay inventory
is represented as live.

PriceMCP is a neutral comparison and evidence layer. It normalizes genuinely
equivalent offers, compares complete prices and material terms, and explains why
an offer wins. Advertising placement, affiliate commission, and supplier payout
are never ranking inputs.

For stays, the comparison unit is the same property, room and bed type,
occupancy, dates, meal plan, and payment basis. Results preserve taxes,
mandatory property fees, deposits, pay-now/pay-later terms, cancellation windows,
availability, source, observation time, and recheck requirements. The first
production flow ends with an attributed provider handoff after a fresh price and
availability check.

## Expedia Rapid application

Official application:
https://partner.expediagroup.com/en-us/join-us/rapid-api

The live form currently requires:

- first name and surname;
- job title;
- business email address;
- company name;
- phone number with country code;
- last year's annual hotel room-night turnover in USD: `0–500k`, `500k–1m`,
  `1–5m`, `5–10m`, or `10m+`;
- optional marketing consent;
- optional consent for Expedia Group B2B to share the application with a
  downstream API partner if direct connectivity is unsuitable.

### Proposed application positioning

> PriceMCP is a public, neutral travel-comparison client backed by an MCP evidence
> layer. We are seeking Rapid Lodging development access for live accommodation
> shopping and attributed provider handoff. The initial integration will not
> collect payment or create bookings. It will normalize the same property, room,
> occupancy, dates, meal plan, payment basis, mandatory taxes and property fees,
> deposit, and cancellation terms; recheck price and availability immediately
> before handoff; keep credentials server-side; respect Rapid rate limits and
> content rules; and keep commercial compensation out of ranking.

### Decisions and facts required from the applicant

- Legal company name and applicant's full legal name.
- Job title, business-domain email, and phone number.
- Actual prior-year hotel room-night turnover bracket. Do not substitute product
  search traffic or projected volume for historical hotel turnover.
- Legal business/tax jurisdiction and initial point of sale.
- Honest expected monthly stay searches and completed handoffs for the first
  twelve months.
- Whether to consent to referral to an Expedia downstream API partner.

Expedia reviews applications case by case. Approved development credentials
remain restricted until the implementation passes Expedia's site review.

## Booking.com application and Demand API escalation

Official affiliate entry point:
https://www.booking.com/affiliate-program/v2/index.html

For North American audience traffic, the public flow currently redirects to a
CJ publisher registration. The first registration page asks for program region,
preferred language, business or tax residence, email, whether the applicant has
a promotional website/blog, a new password, email verification, and reCAPTCHA.
CJ then requires acceptance of legal terms plus tax and banking information
before commissions can be paid.

This public affiliate registration provides links, banners, and deep-link
promotion. It must not be represented as Demand API approval. Demand API access
separately requires Booking.com Managed Affiliate Partner status, an agreed
contract, Partner Centre access supplied by a Booking.com account manager, an API
key, and an `X-Affiliate-Id`.

### Proposed managed-access request

> PriceMCP is a public, neutral travel-comparison client backed by an MCP evidence
> layer. We are applying for Managed Affiliate Partner and Demand API access for
> accommodation shopping and attributed Booking.com handoff. The initial scope
> excludes payment and order creation. We will compare only equivalent property,
> room, occupancy, date, meal-plan, cancellation, fee, and payment-basis offers;
> keep dynamic prices and availability out of persistent storage; cache only
> permitted static/reference content; protect credentials server-side; respect
> rate limits; recheck before handoff; and exclude commission from ranking.

### Decisions and facts required from the applicant

- Program region based on the actual primary audience, not operator location.
- Legal business or tax residence.
- Business email and a user-created password; the applicant must complete email
  verification and reCAPTCHA personally.
- Website ownership/control and traffic or audience evidence if requested.
- Legal entity, tax, and banking details for CJ onboarding.
- The correct Booking.com route or contact for requesting Managed Affiliate and
  Demand API review after affiliate registration. Standard CJ approval alone is
  insufficient.

## Search-and-handoff architecture

```text
Companion stay search
        |
        v
public validation + per-client rate limit + request budget
        |
        v
stay search coordinator
        |
        +-----------------------+
        |                       |
        v                       v
Expedia Rapid adapter     Booking Demand adapter
        |                       |
        +-----------+-----------+
                    v
     property identity + offer normalization
                    |
                    v
 same-property / same-room comparability gate
                    |
                    v
 complete-total ranking + exclusions + provenance
                    |
                    v
 request-local shortlist -> live recheck -> provider handoff
```

### Provider boundary

- Credentials live only in server-side secret storage and are isolated by
  provider and environment.
- Production and sandbox/test inventory never compete in one ranking.
- One provider's failure is disclosed; if every configured provider fails, no
  offer is emitted.
- Static property/reference content is cached only as contracts permit, with
  provider attribution and refresh timestamps.
- Dynamic price and availability are not persistently stored. Shortlists retain
  the normalized selection criteria and provider reference needed to perform a
  fresh search, not a promise that an old rate remains available.
- Cross-provider property matching starts fail-closed. Ambiguous properties,
  rooms, occupancies, meal plans, cancellation terms, fee bases, or payment bases
  are shown separately or excluded from direct ranking.
- Search and recheck responses record currency, point of sale, observed time,
  expiry when supplied, tax/fee basis, stock state, and source dependency.
- Provider handoff occurs only after a successful recheck. Price changes,
  currency changes, expired rates, or unavailable rooms require fresh user
  confirmation.
- The first release handles no traveler PII, card data, booking creation,
  modification, cancellation, confirmation, or customer support.

## Implementation sequence after credentials

1. Add stay input validation, rate limits, request budgets, and provider-specific
   secret configuration.
2. Implement content/reference adapters and conservative property identity
   mapping.
3. Implement live availability adapters and the normalized stay-offer contract.
4. Add complete-total and material-term comparability tests using provider test
   fixtures.
5. Add Companion stay results, offer details, exclusions, and shortlist criteria.
6. Add live recheck and attributed deep-link handoff.
7. Complete provider sandbox validation and production/site review.

Direct booking is a later, separately approved program. It requires provider
order contracts, payment and PCI controls where applicable, traveler-data
handling, confirmations, modification/cancellation, reconciliation, fraud
controls, and support ownership.

## Official references

- Expedia Rapid application: https://partner.expediagroup.com/en-us/join-us/rapid-api
- Expedia Rapid setup: https://developers.expediagroup.com/rapid/setup?locale=en_US
- Expedia lodging launch requirements: https://developers.expediagroup.com/rapid/setup/launch-requirements/lodging-launch-reqs
- Booking.com affiliate program: https://www.booking.com/affiliate-program/v2/index.html
- Booking.com Demand prerequisites: https://developers.booking.com/demand/docs/getting-started/prerequisites
- Booking.com Demand authentication: https://developers.booking.com/demand/docs/development-guide/authentication
- Booking.com production readiness: https://developers.booking.com/demand/docs/development-guide/production-readiness

Form fields and requirements were observed September 4, 2026 and should be
rechecked immediately before submission.
