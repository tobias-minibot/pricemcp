# PriceMCP — TrueForge Hackathon Submission

## Short write-up

AI agents can search for prices, but a plausible price is not necessarily a
comparable or trustworthy offer. PriceMCP gives agents one MCP interface for
canonical product resolution, normalized offers, seller trust, freshness,
conditions, and price history.

The submission demonstrates a complete, guarded agent workflow. A TrueForge
agent resolves an exact Mac mini variant through PriceMCP MCP, compares only
fresh trusted offers, then executes Python in its sandbox to independently
calculate savings and write an evidence-backed procurement brief. It finally
proposes an append-only decision record. TrueForge pauses at that write tool and
requires explicit human approval before durable state changes.

The default demo uses a clearly labeled synthetic dataset. It is reproducible,
does not scrape or imply live inventory, never purchases anything, and makes
unknown shipping and tax visible instead of hiding them in a headline price.

## Why it matters

- Exact product variants are resolved before prices are ranked.
- Untrusted marketplace, stale, unavailable, and membership-only offers cannot
  silently win a normal comparison.
- Every result carries source, timestamp, currency, stock, and condition evidence.
- The agent does useful computation in a sandbox rather than merely echoing a
  tool response.
- The only durable action is explicitly gated by TrueForge human approval.

## Reproduce the demo

Requirements: Node.js 22+, npm, TrueForge 0.1.4+, and an OpenAI-compatible model
configured in TrueForge. The submitted demo uses local Ollama with `qwen3:8b`;
no external LLM credentials are required.

```bash
npm install
npm run check
npm test
npm run demo:start
```

In a second terminal:

```bash
npx @truefoundry/trueforge@0.1.4
```

In TrueForge Settings, add an MCP connector named `pricemcp-demo` with URL
`http://127.0.0.1:3200/mcp`. Add the agent from
[`trueforge/agent.json`](../trueforge/agent.json), adapting only the model name
if necessary. Then prompt:

> Compare the exact Mac mini M6 with 16GB memory and 256GB storage. Produce the
> evidence brief, recommend the best unconditional trusted offer, and propose
> recording the decision.

For the most reliable local-model demo, use three turns in the same TrueForge
session. First submit the comparison prompt above. If the local model stops after
the comparison, continue with:

> Continue with sandbox stage 3. Use exec with an intent and no cwd, write all
> currency as `USD` (no dollar signs), verify procurement-brief.md, and show its
> absolute sandbox artifact link. Do not record the decision yet.

Then submit:

> The brief is verified. Propose record_decision for the selected exact product
> and merchant. Do not bypass approval.

Expected visible sequence across the session:

1. TrueForge calls PriceMCP `find_best_offer` and `compare_prices` over MCP.
2. TrueForge starts its sandbox, runs Python, and creates `procurement-brief.md`.
3. TrueForge proposes `record_decision`.
4. The run pauses for human approval before the append-only database write.

All displayed demo prices must retain the `synthetic: true` and
`dataset: pricemcp-demo-v1` disclosure.

## Verification status

- TypeScript check: passing
- Automated tests: 33 passing
- Synthetic website, REST, and MCP: passing locally
- TrueForge connector: seven PriceMCP tools discovered
- TrueForge MCP + sandbox + approval run: verified locally; an intentionally
  denied first decision proved that invalid evidence cannot cross the durable
  write boundary
- Public repository, Qodo PR review, video, and submission URL: pending publisher
  approval; no evidence is claimed before those external steps occur

## Safety boundary

`record_decision` appends a decision receipt; it does not buy, reserve, message a
merchant, or spend money. It is marked non-read-only, destructive, and
non-idempotent in MCP annotations so TrueForge treats it as approval-required.
The agent manifest also names the tool explicitly in
`require_approval_for_tools`.
