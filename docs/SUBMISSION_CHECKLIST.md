# Submission checklist

Every hackathon entry must clear this list before the Devpost form is touched.
The bar rises with each entry: an item that was optional last time is required
this time. The WebMCP entry (2026-09-03) shipped with the wrong narration voice
and had to be re-cut; this list exists so that class of mistake cannot recur.

## 1. Baseline

- [ ] `main` is green: `npm run check`, `npm test`, `npm audit --audit-level=high`.
- [ ] Companion tests pass: `uv run --project agents/strands pytest -q agents/strands/tests`.
- [ ] No open PRs from the previous entry. Merge or close them first.
- [ ] Tag the submission head: `git tag -a submission/<event>-<yyyy-mm-dd> -m "<event>"` and push the tag.
- [ ] Live deployment on Vercel matches the tagged head (compare the commit in the Vercel dashboard).

## 2. Substance (what judges actually score)

- [ ] At least one **live, credentialed** data source is exercised in the demo. Synthetic
      offers may appear only when labeled synthetic on screen. Amadeus test credentials
      are free; Duffel test tokens are free. Do not enter a travel-facing hackathon on
      synthetic-only inventory.
- [ ] The sponsor's required technology is used substantively, not as a wrapper.
      Agents for Humans → a Strands agent that does the reasoning (see `agents/strands`).
      Nebius/NVIDIA → the model or runtime actually executes there.
- [ ] End-to-end run recorded: `PRICEMCP_E2E=1 uv run --project agents/strands pytest -k e2e`
      passes against the deployed MCP endpoint, and the tool calls it made are quoted
      in the write-up.
- [ ] One new capability since the previous entry, stated in the first paragraph of the
      write-up with a link to the commit. Judges re-read prior entries.

## 3. Media

- [ ] Narration voice is **OpenAI Cedar**. Never macOS `say` voices, regardless of deadline.
- [ ] Demo length within the event limit (check the rules page; usually 3 or 5 minutes).
- [ ] Video shows the live URL in the address bar, not localhost.
- [ ] Screenshot is current (taken from the tagged head).
- [ ] SHA-256 of the final video stored under `docs/assets/` next to the previous ones.

## 4. Write-up

- [ ] Architecture diagram present and reflects the tagged head.
- [ ] Reproduction steps run from a clean clone in under 10 minutes; someone other than the
      author has followed them once.
- [ ] Disclosures: what is synthetic, what is read-only, what the agent cannot do.
- [ ] Team, license, and public repo link.

## 5. After submitting

- [ ] Save the confirmation screenshot and entry URL in `memory/` and in `docs/SUBMISSION.md`.
- [ ] Record the event's editing deadline. Fixes are allowed until then.
- [ ] Open the next entry's tracking issue with the "one new capability" already chosen.
