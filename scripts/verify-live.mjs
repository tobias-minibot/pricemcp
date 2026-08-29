import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const baseUrl = new URL(process.env.PRICEMCP_LIVE_URL || 'https://pricemcp.vercel.app');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(path, init) {
  const response = await fetch(new URL(path, baseUrl), init);
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return response.json();
}

const health = await readJson('/internal/health');
assert(health.status === 'ok', 'health status is not ok');
assert(health.dataset === 'live', `expected live dataset, got ${health.dataset}`);
assert(health.synthetic === false, 'production health is marked synthetic');
assert(health.counts?.fresh_available_offers > 0, 'production has no fresh available offers');

const search = await readJson('/v1/search-price', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'product', query: 'AirPods Pro 3' }),
});
assert(search.status === 'ok', `live search failed with status ${search.status}`);
assert(search.dataset === 'live' && search.synthetic === false, 'search lost live provenance');
assert(search.best_offer?.dataset === 'live' && search.best_offer?.synthetic === false, 'best offer lost live provenance');
assert(search.best_offer?.source?.url, 'best offer has no evidence URL');
assert(search.best_offer?.observed_at, 'best offer has no observation timestamp');

const client = new Client({ name: 'pricemcp-live-smoke', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(new URL('/mcp', baseUrl));
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const toolNames = tools.map((tool) => tool.name);
  assert(toolNames.includes('search_price'), 'live MCP is missing search_price');
  assert(!toolNames.includes('record_decision'), 'live MCP exposes record_decision');

  const result = await client.callTool({
    name: 'search_price',
    arguments: { type: 'product', query: 'AirPods Pro 3' },
  });
  assert(!result.isError, 'live MCP search_price returned an error');
  assert(result.structuredContent?.dataset === 'live', 'MCP result lost live provenance');
  assert(result.structuredContent?.synthetic === false, 'MCP result is marked synthetic');

  console.log(JSON.stringify({
    status: 'ok',
    base_url: baseUrl.origin,
    products: health.counts.products,
    fresh_available_offers: health.counts.fresh_available_offers,
    best_provider: search.best_offer.provider.name,
    best_total_minor: search.best_offer.quote.total_minor,
    observed_at: search.best_offer.observed_at,
    mcp_tools: toolNames,
    read_only_boundary: 'record_decision absent',
  }, null, 2));
} finally {
  await client.close();
}
