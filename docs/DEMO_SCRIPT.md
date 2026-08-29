# Two-minute judge-first demo script

## 0:00–0:12 — Establish the infrastructure thesis

Open the public homepage and say:

“PriceMCP is one neutral price layer for people and AI agents. The same search
surface serves the consumer UI, REST, and MCP. There are no ads or sponsored
results.” Click **Open infrastructure console** immediately.

## 0:12–0:55 — Show live MCP infrastructure

The console automatically invokes `search_price` for AirPods Pro 3 through an
official MCP SDK client. In one sweep, point to:

- the actual MCP request and live structured response;
- the canonical product ID;
- the provider fan-in count and names;
- normalized quote totals, trust, freshness, timestamps, source methods, and
  clickable retailer provenance;
- measured invocation latency; and
- the live `tools/list` schemas below the response.

Say: “This is not a UI reconstruction. This page asks the actual PriceMCP MCP
server to list and execute its tools against the deployed read-only dataset.”

## 0:55–1:23 — Show tool discovery and prove the cross-domain contract

Click **Run disclosed flight fixture**. Point out that the same `search_price`
tool now accepts an itinerary and returns the same quote envelope with
flight-specific conditions. Call out the visible `SYNTHETIC / NOT BOOKABLE`
state. Say: “Without a configured live provider PriceMCP fails closed; this
fixture proves the domain contract without fabricating a live fare.”

## 1:23–1:34 — Real agent work

In TrueForge, submit:

> Compare the exact Mac mini M6 with 16GB memory and 256GB storage. Produce the
> evidence brief, recommend the best unconditional trusted offer, and propose
> recording the decision.

Expand the tool timeline. Show `find_best_offer` resolving the exact canonical
variant and `compare_prices` returning normalized seller and condition evidence.
Point out why the cheapest untrusted or conditional offer does not win.

Briefly show that `search_price` accepts both `{ type: "product", query: ... }`
and `{ type: "flight", origin: "WAS", destination: "BER", ... }`. The existing
product tools remain available for the deeper procurement workflow.

## 1:34–1:49 — Sandbox execution and human approval boundary

If the local model has stopped after comparison, send the prepared “Continue
with sandbox stage 3” prompt from `docs/SUBMISSION.md`. Show TrueForge creating
its sandbox and running Python. Open or download
`procurement-brief.md`. Highlight the independently calculated savings, exact
variant, merchant, evidence timestamp, and explicit tax/shipping uncertainty.

## 1:49–2:08 — Reproducibility and close

Show the pending `record_decision` tool call. Say:

“The research and calculation were autonomous. A durable action is not. The MCP
tool is annotated as destructive and non-idempotent, and the TrueForge manifest
explicitly requires human approval.”

Show its append-only decision receipt and confirm that it did not place an order
or contact a merchant. Close on the public architecture and final receipt while
calling out the repository, automated tests, workflow audits, live deployment,
and Qodo-reviewed pull requests.

Close with: “PriceMCP turns price search into comparable evidence, then lets the
human retain control at the action boundary.”
