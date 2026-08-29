# Three-minute demo script

## 0:00–0:35 — The universal price-search story

Open the mobile-width homepage. Search for `Mac mini M4 16GB 256GB`, then
`Flight Washington to Berlin`.

“PriceMCP is one neutral price layer for people and AI agents. The same search
surface resolves an exact product or a flight itinerary, normalizes comparable
offers, and says why the best option ranks first. There are no ads or sponsored
results.”

Point out the persistent synthetic-data banner and the flight fixture’s explicit
“not bookable” condition. The demo proves the abstraction without representing
mock fares as live facts.

## 0:35–0:55 — The architecture

Show the README architecture for a moment:

`TrueForge agent → PriceMCP MCP → normalized SQLite evidence → guarded action`

Mention that the demo dataset deliberately contains official, trusted,
membership, untrusted marketplace, stale, and unavailable offers.

## 0:55–1:30 — Real MCP work

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
