# Three-minute demo script

## 0:00–0:10 — Establish the consumer promise

Open the public homepage and say:

“PriceMCP is one neutral price layer for people and AI agents. The same search
surface serves the consumer UI, REST, and MCP. There are no ads or sponsored
results.” Click **Open infrastructure console** immediately.

## 0:10–0:40 — Show live MCP infrastructure

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

## 0:40–1:00 — Prove the cross-domain contract

Click **Run disclosed flight fixture**. Point out that the same `search_price`
tool now accepts an itinerary and returns the same quote envelope with
flight-specific conditions. Call out the visible `SYNTHETIC / NOT BOOKABLE`
state. Say: “Without a configured live provider PriceMCP fails closed; this
fixture proves the domain contract without fabricating a live fare.”

## 1:00–1:35 — Real agent work

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

## 1:30–1:55 — Sandbox execution

If the local model has stopped after comparison, send the prepared “Continue
with sandbox stage 3” prompt from `docs/SUBMISSION.md`. Show TrueForge creating
its sandbox and running Python. Open or download
`procurement-brief.md`. Highlight the independently calculated savings, exact
variant, merchant, evidence timestamp, and explicit tax/shipping uncertainty.

## 1:55–2:30 — Human approval boundary

Send the prepared “Propose record_decision” prompt. Show the pending
`record_decision` tool call. Say:

“The research and calculation were autonomous. A durable action is not. The MCP
tool is annotated as destructive and non-idempotent, and the TrueForge manifest
explicitly requires human approval.”

Approve the tool live. Show its append-only decision ID and confirm that it did
not place an order or contact a merchant.

## 2:30–3:00 — Reproducibility and Qodo

Show the passing test command, public repository, and README’s
`Qodo Code Review Evidence` section. Open the linked PR and briefly show Qodo’s
two valid audit findings, the code changes that resolved them, and the passing
CI check on the reviewed commit. If the remaining TypeScript finding is visible,
state plainly that it is disputed—not dismissed—and point to the passing check
as the evidence.

Close with: “PriceMCP turns price search into comparable evidence, then lets the
human retain control at the action boundary.”
