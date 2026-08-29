# PriceMCP demo narration

## 0:00–0:25 — Why this exists

An AI can find a price, but that does not make the offer comparable or safe to
recommend. The result might be the wrong variant, stale, unavailable,
membership-only, or sold by an unknown marketplace seller. PriceMCP gives
agents one evidence-backed interface for exact product identity, normalized
prices, merchant trust, freshness, conditions, and history.

## 0:25–0:55 — Controlled evidence

This public demo uses synthetic, non-purchasable data so anyone can reproduce
the behavior without scraping a live store during judging. The Mac mini fixture
deliberately includes stale offers, an unavailable offer, a marketplace seller,
a membership price, an official reference, and an unconditional trusted offer.
Northstar Retail wins at six hundred twenty-two dollars and eleven cents. It is
seventy-six dollars and eighty-nine cents below the official benchmark.

## 0:55–1:25 — Architecture

TrueForge runs the agent session. It calls PriceMCP over Model Context Protocol
to resolve the exact variant and compare trusted offers. PriceMCP returns
deterministic evidence from its normalized SQLite model. TrueForge then starts
its sandbox, runs a calculation, and writes a procurement brief with the exact
merchant, amount, timestamp, and disclosed assumptions.

## 1:25–2:05 — Human control

The research and computation are autonomous. Durable state is not. After the
sandbox artifact was verified, the agent proposed the record-decision tool.
TrueForge first asked the user to confirm the proposed choice, then paused again
at the actual MCP tool call. The request, product, merchant, and rationale are
visible before anything changes. The user can allow or deny it.

## 2:05–2:30 — Verified outcome

After approval, PriceMCP independently rechecked that the selected offer was
fresh, trusted, unconditional, available, and new. Only then did it append a
decision receipt. It did not purchase, reserve inventory, contact a merchant,
or spend money. The final response keeps the synthetic-data, tax, and shipping
disclosures visible.

## 2:30–3:00 — Reproducibility

The repository is public and includes the TrueForge agent manifest, MCP server,
synthetic benchmark, architecture diagram, demo script, and evidence
screenshots. Thirty-three automated tests, TypeScript checking, dependency
audit, and GitHub Actions pass. The representative pull request is reviewed
through Qodo and linked from the README. PriceMCP turns price search into
comparable evidence while leaving the consequential action with the human.
