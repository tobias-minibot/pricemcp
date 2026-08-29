# PriceMCP demo narration — infrastructure cut

The submission cut is approximately 2:08 and leads with the live MCP
infrastructure proof. Every live claim in the narration is exercised against the
public deployment; the flight example remains explicitly synthetic and
non-bookable.

## 0:00–0:12 — Product thesis

PriceMCP is not a shopping website. It is an MCP-first, AI-native price
infrastructure layer: one neutral interface for asking what something costs
across products, flights, and future price domains.

## 0:12–0:26 — Real MCP invocation

Here is the public production console. An official Model Context Protocol SDK
client calls the deployed PriceMCP server. The request resolves AirPods Pro 3 to
one canonical entity, then fans in observations from five trusted retailers.

## 0:26–0:40 — Structured response

This is the actual MCP request and structured response, not a copied REST
result. PriceMCP preserves the canonical product, the winning offer, every
normalized alternative, the ranking policy, and the measured invocation
latency.

## 0:40–0:55 — Normalization and provenance

The heterogeneous retailer records become one comparable quote envelope. Each
offer keeps merchant trust, normalized total, match confidence, observation
time, freshness, collection method, source product identifier, and a clickable
provenance URL.

## 0:55–1:08 — Tool discovery

Agents discover seven production tools through live tools list. Search price is
the universal primitive. Product-specific tools remain for compatibility,
while all exposed production tools are read-only and described by
machine-readable JSON schemas.

## 1:08–1:23 — Cross-domain contract

The same search price tool also accepts a complete flight itinerary and returns
the same evidence envelope with domain-specific fields. This example is
intentionally synthetic and not bookable. Without a configured live provider,
PriceMCP fails closed instead of inventing a fare.

## 1:23–1:34 — Agent execution

TrueForge proves that an agent can use the layer. It calls PriceMCP, compares
exact evidence, runs an independent calculation in a sandbox, and produces a
procurement brief with disclosed assumptions.

## 1:34–1:49 — Human approval boundary

Research and computation are autonomous. Durable state is not. Before recording
a decision, the agent pauses at an explicit human approval boundary. The
reviewed request is append-only; it does not purchase, reserve inventory,
contact a merchant, or spend money.

## 1:49–2:08 — Reproducibility

The complete system is public and reproducible: MCP server, normalized data
model, product and flight contract, TrueForge manifest, Qodo-reviewed pull
requests, automated tests, workflow audits, and live deployment. PriceMCP turns
a price question into structured, source-backed evidence that any agent can
use.
