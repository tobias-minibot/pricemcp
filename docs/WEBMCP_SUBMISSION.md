# PriceMCP — WebMCP Challenge

- Live application: <https://pricemcp.vercel.app>
- Public 1:30 YouTube demo: <https://youtu.be/8UA3jLzF6_s>
- Reproducible video backup: <https://github.com/tobias-minibot/pricemcp/releases/download/webmcp-challenge-v2/pricemcp-webmcp-demo.mp4>
- Implementation pull requests: [#30](https://github.com/tobias-minibot/pricemcp/pull/30), [#31](https://github.com/tobias-minibot/pricemcp/pull/31)

## What people and agents do together

A person opens PriceMCP and asks their browser agent to find an exact product
variant. The agent calls `find_best_price` instead of guessing through page
controls or scraping rendered text. PriceMCP resolves the canonical product,
excludes stale, unavailable, conditional, or untrusted offers from the winner,
and returns compact evidence with timestamps, conditions, and source URLs.

The result is also rendered into the open page. Person and agent can inspect the
same winning offer and ranking explanation, then use
`inspect_price_evidence` to audit the underlying seller records. This shared
page state is the collaboration boundary: the agent researches; the person sees
and judges the evidence. The WebMCP tools are read-only and never purchase,
reserve, subscribe, message a seller, or write a procurement decision.

## Why WebMCP

Ordinary browser automation would have to infer PriceMCP's meaning from forms,
cards, and text. The existing backend MCP endpoint is structured but is not
automatically available to a browser agent. WebMCP bridges the actual web app:
the page advertises purpose-built tools, validates structured arguments, calls
the same read-only price pipeline as the human interface, and visibly shares the
result back into the page.

## Implementation

`src/webmcp.ts` registers three imperative WebMCP tools with
`document.modelContext.registerTool(...)`:

1. `find_best_price({ query })` calls PriceMCP's read-only MCP diagnostic bridge
   at `/v1/mcp/search`. It returns the canonical subject, best qualifying offer,
   two alternatives, ranking reasons, observation time, and provenance.
2. `inspect_price_evidence({ product_id, max_age_hours })` calls the canonical
   product offer endpoint and returns up to three seller observations with their
   trust, availability, membership, freshness, and source fields.
3. `run_flight_price_demo({})` runs a permanent, explicitly synthetic and
   non-bookable WAS–BER fixture through the existing read-only MCP diagnostic
   bridge. It lets judges verify discovery, execution, shared page state, and
   normalized conditions even after the deployed product snapshot has aged.

Tool descriptions and outputs follow Chrome's recommended character budgets.
Both tools set `readOnlyHint: true` and `untrustedContentHint: true`. Fetches
receive the WebMCP execution `AbortSignal`. Returned data is capped before the
1,500-character recommendation, and DOM updates use `textContent` rather than
injecting retailer content as HTML.

The original PriceMCP repository was created on August 29, 2026, inside the
challenge period that began August 25. Browser WebMCP support was added on
September 3; its commits and pull request distinguish this challenge-specific
implementation from the prior backend MCP work.

## Reproduce

1. Open <https://pricemcp.vercel.app> in ChatGPT's in-app browser, or Chrome
   149+ with `chrome://flags/#enable-webmcp-testing` enabled.
2. Ask the agent: `Find the best trustworthy price for AirPods Pro 3 and explain
   why it wins.`
3. Confirm that it discovers and calls `find_best_price`. The page should display
   a **Shared agent result** containing the same winner and explanation returned
   to the agent.
4. Ask: `Inspect the source evidence for the canonical product you found.`
5. Confirm that it calls `inspect_price_evidence` and reports seller trust,
   availability, membership dependency, freshness, timestamp, and source URL.
6. For a permanent reproduction path, ask: `Run PriceMCP's disclosed WebMCP
   flight demo.` Confirm that the response and page both label it synthetic and
   non-bookable.

In a browser without WebMCP, the fixed status pill explains how to enable it.
All production tools remain read-only. Product data is a deployed timestamped
snapshot; location-dependent tax is excluded and unknown shipping is disclosed
rather than estimated.

## Verified evidence

On September 3, 2026 UTC, Chrome 152 with `WebMCPTesting` enabled discovered all
three tools through `document.modelContext.getTools()` and executed
`run_flight_price_demo` through `document.modelContext.executeTool()`. The live
result reported `dataset: pricemcp-demo-v1`, `synthetic: true`, and the boundary
`Synthetic demonstration; not live, purchasable, or bookable.` The same
execution rendered the shared WAS–BER result into the page.

The YouTube upload is 1:30, public, contains OpenAI Cedar narration, and passed
YouTube's checks with no issues found. Its exact release backup has SHA-256
digest
`c215d98c83b331ea1cfad8cce71e4de61fa03ef84232f6826a1e75d55bbe5ee0`.
