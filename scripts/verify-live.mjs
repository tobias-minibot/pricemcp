import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { execFileSync } from 'node:child_process';

const baseUrl = new URL(process.env.PRICEMCP_LIVE_URL || 'https://pricemcp.vercel.app');
const requestTimeoutMs = 20_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function timeoutSignal(signal) {
  const timeout = AbortSignal.timeout(requestTimeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

async function timedFetch(input, init = {}) {
  return fetch(input, { ...init, signal: timeoutSignal(init.signal) });
}

async function readJson(path, init = {}) {
  const response = await timedFetch(new URL(path, baseUrl), init);
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response.json();
}

async function readText(path) {
  const response = await timedFetch(new URL(path, baseUrl));
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response.text();
}

const health = await readJson('/internal/health');
assert(health.status === 'ok', 'health status is not ok');
assert(health.dataset === 'live', `expected live dataset, got ${health.dataset}`);
assert(health.synthetic === false, 'production health is marked synthetic');
assert(health.counts?.products > 0, 'production snapshot has no products');
assert(health.counts?.current_offers > 0, 'production snapshot has no offers');
assert(health.counts?.fresh_available_offers > 0, 'production snapshot has no fresh available offers');
const lastRefreshMs = Date.parse(health.last_refresh);
assert(Number.isFinite(lastRefreshMs), 'production snapshot has no valid last_refresh timestamp');
const snapshotAgeHours = Math.max(1, Math.ceil((Date.now() - lastRefreshMs) / 3_600_000) + 1);

const search = await readJson(`/v1/search-price?max_age_hours=${snapshotAgeHours}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'product', query: 'AirPods Pro 3' }),
});
assert(search.status === 'ok', `live search failed with status ${search.status}`);
assert(search.dataset === 'live' && search.synthetic === false, 'search lost live provenance');
assert(search.best_offer?.dataset === 'live' && search.best_offer?.synthetic === false, 'best offer lost live provenance');
assert(search.best_offer?.source?.url, 'best offer has no evidence URL');
assert(search.best_offer?.observed_at, 'best offer has no observation timestamp');

const home = await readText('/');
const firstDecisionAt = home.indexOf('Start with a real decision');
const infrastructureAt = home.indexOf('Live infrastructure feed');
assert(firstDecisionAt >= 0, 'homepage is missing the first-decision journey');
assert(home.includes('href="/companion?q=I%20need%20AirPods%20Pro%203%20under%20%24300"'), 'homepage has no Companion entry point');
assert(home.includes('href="/products/apple-airpods-pro-3"'), 'homepage has no working evidence entry point');
assert(home.includes('href="/decisions"'), 'homepage has no saved-decision return path');
assert(infrastructureAt < 0 || firstDecisionAt < infrastructureAt, 'homepage shows infrastructure before the user journey');

const cheapApplesPage = await readText('/cheap-apples');
assert(cheapApplesPage.includes('<title>Cheap Apples — verified Apple prices</title>'), 'Cheap Apples is missing its B2C identity');
assert(cheapApplesPage.includes('action="/companion"'), 'Cheap Apples is not connected to Companion');
assert(cheapApplesPage.includes('href="/products/'), 'Cheap Apples has no evidence path');
assert((cheapApplesPage.match(/class="ca-product"/g) || []).length === 37, 'Cheap Apples does not expose all 37 active catalog products');
assert(cheapApplesPage.includes('Not affiliated with or endorsed by Apple Inc.'), 'Cheap Apples is missing its affiliation boundary');

const productPath = `/products/${search.subject.product_id}`;
const productPage = await readText(productPath);
assert(productPage.includes('Save this decision'), 'product page is missing save controls');
assert(productPage.includes('Recheck evidence'), 'product page is missing recheck controls');
const handoffMatch = productPage.match(/id="winner-source"[^>]*href="([^"]+)"/);
assert(handoffMatch, 'fresh recommended offer has no retailer handoff');
const handoffUrl = new URL(handoffMatch[1]);
assert(handoffUrl.protocol === 'https:', 'retailer handoff is not HTTPS');

const companionPage = await readText('/companion?q=I%20need%20AirPods%20Pro%203%20under%20%24300');
assert(companionPage.includes('Tell me what you’re buying.'), 'Companion is not product-first');
assert(companionPage.includes("fetch('/v1/mcp/search'"), 'Companion is not wired to live MCP search');
assert(companionPage.includes("url.protocol==='https:'"), 'Companion lacks an HTTPS handoff boundary');
assert(companionPage.includes('/companion/flights'), 'Companion lost the disclosed flight-lab boundary');
const watchlistPage = await readText('/decisions');
assert(watchlistPage.includes('Your decision watchlist'), 'saved decisions are not rendered as a watchlist');
assert(watchlistPage.includes('Recheck all'), 'watchlist has no batch recheck');
assert(watchlistPage.includes("fetch('/v1/mcp/search'"), 'watchlist is not wired to current evidence');

execFileSync(process.execPath, ['scripts/verify-browser-funnel.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PRICEMCP_LIVE_URL: baseUrl.href },
  stdio: 'inherit',
});

const client = new Client({ name: 'pricemcp-live-smoke', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL('/mcp', baseUrl), { fetch: timedFetch });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const toolNames = tools.map((tool) => tool.name);
  assert(toolNames.includes('search_price'), 'live MCP is missing search_price');
  assert(!toolNames.includes('record_decision'), 'live MCP exposes record_decision');

  const result = await client.callTool({
    name: 'compare_prices',
    arguments: {
      product_id: search.subject.product_id,
      trusted_only: true,
      include_membership: false,
      max_age_hours: snapshotAgeHours,
    },
  });
  assert(!result.isError, 'live MCP compare_prices returned an error');
  assert(result.structuredContent?.offers?.length > 0, 'live MCP returned no snapshot offers');
  assert(
    result.structuredContent.offers.every((offer) => offer.dataset === 'live' && offer.synthetic === false),
    'MCP offers lost live provenance',
  );

  console.log(JSON.stringify({
    status: 'ok',
    base_url: baseUrl.origin,
    products: health.counts.products,
    snapshot_offers: health.counts.current_offers,
    snapshot_last_refresh: health.last_refresh,
    snapshot_max_age_hours: snapshotAgeHours,
    best_provider: search.best_offer.provider.name,
    best_total_minor: search.best_offer.quote.total_minor,
    observed_at: search.best_offer.observed_at,
    consumer_journey: 'ask Companion → compare → save → watch/recheck → HTTPS retailer handoff',
    retailer_handoff: handoffUrl.origin,
    mcp_tools: toolNames,
    read_only_boundary: 'record_decision absent',
    snapshot_contract: 'timestamped read-only evidence; freshness is reported, not required',
  }, null, 2));
} finally {
  await client.close();
}
