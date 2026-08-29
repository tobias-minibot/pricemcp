# Three-minute demo script

## 0:00–0:25 — The problem

“A low headline price can be the wrong model, stale, unavailable, membership
only, or from an unknown marketplace seller. PriceMCP gives an AI agent one
normalized, evidence-backed price interface.”

Show the PriceMCP synthetic-demo banner and the Mac mini M6 product page. Point
out that the prices are explicitly synthetic and non-purchasable.

## 0:25–0:50 — The architecture

Show the README architecture for a moment:

`TrueForge agent → PriceMCP MCP → normalized SQLite evidence → guarded action`

Mention that the demo dataset deliberately contains official, trusted,
membership, untrusted marketplace, stale, and unavailable offers.

## 0:50–1:25 — Real MCP work

In TrueForge, submit:

> Compare the exact Mac mini M6 with 16GB memory and 256GB storage. Produce the
> evidence brief, recommend the best unconditional trusted offer, and propose
> recording the decision.

Expand the tool timeline. Show `find_best_offer` resolving the exact canonical
variant and `compare_prices` returning normalized seller and condition evidence.
Point out why the cheapest untrusted or conditional offer does not win.

## 1:25–1:55 — Sandbox execution

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
