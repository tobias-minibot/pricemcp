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

## Submission form copy

### What does your project do?

PriceMCP gives AI agents one MCP interface for trustworthy price comparison.
It resolves an exact product variant before ranking normalized offers, then
returns merchant identity, price, currency, freshness, availability,
conditions, and provenance. The hackathon wedge focuses on Apple products and
is demonstrated with a controlled synthetic benchmark, so judges can reproduce
trust, membership, stale-price, marketplace, and unavailable-offer cases
without relying on a retailer scrape during judging. It is for agent builders
who need comparable evidence rather than an unverified headline price.

### How did you use TrueForge?

TrueForge runs a cautious procurement-analysis agent. The harness calls
PriceMCP's real MCP tools to resolve and compare an exact Mac mini variant,
starts a sandbox, runs Python to independently calculate savings, and writes a
downloadable evidence brief. When the agent proposes the non-idempotent
`record_decision` tool, TrueForge displays the exact request and pauses for
human approval before PriceMCP can append durable state. The demo therefore
shows tool access, sandbox execution, and a visible human control boundary in
one workflow.

### How did you use Qodo?

Qodo reviewed the substantive approval-boundary pull request before it was
merged. Its final review covered commit `671da48` and reported 0 bugs, 0 rule
violations, and 0 requirement gaps, so there was no valid finding to fix or
dismiss. The public PR preserves the completed review, earlier review state,
final-code confirmation, CI result, and merge history as reproducible evidence.

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
- TrueForge MCP + sandbox + approval run: verified end to end; an intentionally
  denied first decision proved that invalid evidence cannot cross the durable
  write boundary, and the corrected run produced the approved decision receipt
- Public repository: `https://github.com/tobias-minibot/pricemcp`
- Representative merged PR: `https://github.com/tobias-minibot/pricemcp/pull/1`
- Qodo review: `https://github.com/tobias-minibot/pricemcp/pull/1#issuecomment-5464110797`
  (0 bugs, 0 rule violations, 0 requirement gaps)
- Qodo final-code confirmation through commit `671da48`:
  `https://github.com/tobias-minibot/pricemcp/pull/1#issuecomment-5464137458`
- Demo video:
  `https://github.com/tobias-minibot/pricemcp/releases/download/hackathon-demo-v1/pricemcp-demo.mp4`
- Required YouTube submission URL: `https://youtu.be/UFDzSPeujXQ`
  (unlisted; the GitHub release above is the verified backup copy)
- Submission receipt: pending until the official form is sent

## AI-use disclosure

Codex, running through OpenClaw, assisted with implementation, tests,
documentation, and demo preparation. Tobias directed scope and external
actions, and the team verified the work through tests, TypeScript, GitHub
Actions, primary-source checks, and the recorded TrueForge workflow. The
demonstrated procurement agent itself runs the local `qwen3:8b` model through
TrueForge.

## Safety boundary

`record_decision` appends a decision receipt; it does not buy, reserve, message a
merchant, or spend money. It is marked non-read-only, destructive, and
non-idempotent in MCP annotations so TrueForge treats it as approval-required.
The agent manifest also names the tool explicitly in
`require_approval_for_tools`.
