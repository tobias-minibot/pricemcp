# PriceMCP Companion — Strands agent

This is a separate consumer decision agent over the unchanged PriceMCP MCP
server. Strands owns the reasoning loop; PriceMCP remains the deterministic,
neutral evidence layer. The default model is the local `qwen3:8b` Ollama model,
so the documented path needs no external LLM account or price-data disclosure.

```bash
ollama serve
npm start
uv run --project agents/strands python agents/strands/companion_agent.py \
  "Find the best trustworthy price for MacBook Air M5 13-inch 16GB 512GB"
```

Set `PRICEMCP_MCP_URL` for another PriceMCP Streamable HTTP endpoint and
`PRICEMCP_OLLAMA_MODEL` for another local tool-capable model. Only read-only MCP
tools are allowlisted. The agent cannot record a decision, purchase, reserve, or
contact a provider.

Architecture:

```text
Human request
  → Strands Agent + local Ollama model
  → official Strands MCPClient
  → unchanged PriceMCP /mcp server
  → canonical subjects, normalized offers, evidence, and ranking
  → explanation and human-controlled provider handoff
```

## Tests

```bash
uv run --project agents/strands pytest -q agents/strands/tests            # unit, no network
PRICEMCP_E2E=1 uv run --project agents/strands pytest -q -k e2e            # live server + Ollama
```

The unit tests assert that every allowlisted tool exists on the PriceMCP server
and that `record_decision` is never exposed. CI runs them on every push.

## Verified run (2026-09-03, local qwen3:8b, live server on :3199)

Request: `Find the best trustworthy price for AirPods Pro 3`

Tool calls: `search_products` → `get_price`

> The best trustworthy price for **AirPods Pro 3** is **$224.99** at **Target**
> (verified merchant, in-stock, no membership required). The offer is fresh (less
> than 2 hours old) and matches Apple's official product listing.
> **Next decision:** Would you like to proceed with this offer, or check other
> trusted sellers for potential savings?
