import * as cheerio from 'cheerio';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { catalog, merchants } from './catalog.js';
import { matchProduct, parsePrice } from './normalize.js';
import type { CollectorResult, RawObservation } from './types.js';

export interface BrightDataTarget {
  merchant_id: string;
  merchant_name: string;
  url: string;
  expected_product_id: string;
  source_product_id: string;
  accepted_sellers: string[];
  accepted_hosts?: string[];
  seller_markers?: string[];
  html_patterns?: ExtractionPatterns;
  markdown_patterns?: ExtractionPatterns;
  selectors?: {
    title?: string[];
    price?: string[];
    availability?: string[];
    seller?: string[];
    sku?: string[];
  };
}

type ExtractedProduct = {
  title: string;
  raw_price: string;
  currency: string;
  available: boolean;
  seller: string;
  source_product_id: string;
  extraction_path: 'json-ld' | 'saved-selectors' | 'saved-html-rules' | 'saved-markdown-rules';
  selector_repairs: string[];
};

type ExtractionPatterns = {
  title: string;
  price: string;
  availability: string;
  seller?: string;
  sku: string;
};

const MARKDOWN_PREFIX = 'PRICEMCP_BRIGHTDATA_MARKDOWN\n';

const capturePattern = (document: string, pattern: string): string =>
  document.match(new RegExp(pattern, 'im'))?.[1]?.replace(/\s+/g, ' ').trim() ?? '';

const textContent = (content: unknown): string => {
  if (!Array.isArray(content)) return '';
  return content.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const block = item as Record<string, unknown>;
    return block.type === 'text' && typeof block.text === 'string' ? [block.text] : [];
  }).join('\n');
};

const extractWithPatterns = (
  document: string,
  patterns: ExtractionPatterns,
  extractionPath: ExtractedProduct['extraction_path']
): ExtractedProduct => {
  const title = capturePattern(document, patterns.title);
  const rawPrice = capturePattern(document, patterns.price);
  const availability = capturePattern(document, patterns.availability);
  const seller = patterns.seller ? capturePattern(document, patterns.seller) : '';
  const sku = capturePattern(document, patterns.sku);
  if (!title || !rawPrice || !sku) {
    throw new Error(`Schema drift: ${extractionPath} rules did not produce title, price, and SKU`);
  }
  return {
    title,
    raw_price: rawPrice.startsWith('$') ? rawPrice : `$${rawPrice}`,
    currency: 'USD',
    available: hasPositiveAvailability(availability),
    seller,
    source_product_id: sku,
    extraction_path: extractionPath,
    selector_repairs: Object.values(patterns)
  };
};

const textAtFirstMatch = ($: cheerio.CheerioAPI, selectors: string[] = []): { value: string; selector?: string } => {
  for (const selector of selectors) {
    const value = $(selector).first().text().replace(/\s+/g, ' ').trim();
    if (value) return { value, selector };
  }
  return { value: '' };
};

const jsonLdProducts = ($: cheerio.CheerioAPI): any[] => {
  const products: any[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const value = queue.shift();
        if (!value || typeof value !== 'object') continue;
        const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
        if (types.some((type: unknown) => String(type).toLowerCase() === 'product')) products.push(value);
        if (Array.isArray(value['@graph'])) queue.push(...value['@graph']);
      }
    } catch { /* malformed blocks are ignored; saved selectors are the repair path */ }
  });
  return products;
};

const hasPositiveAvailability = (value: string): boolean => /(?:^|\W)(?:in\s*stock|limited\s*availability|available\s*(?:now|for|today)?|ready\s+within)(?:\W|$)/i.test(value);

export function extractBrightDataProduct(html: string, target: BrightDataTarget): ExtractedProduct {
  if (html.startsWith(MARKDOWN_PREFIX)) {
    if (!target.markdown_patterns) {
      throw new Error('Schema drift: HTML unavailable and no saved markdown repair rules configured');
    }
    return extractWithPatterns(
      html.slice(MARKDOWN_PREFIX.length),
      target.markdown_patterns,
      'saved-markdown-rules'
    );
  }
  const $ = cheerio.load(html);
  for (const product of jsonLdProducts($)) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers].filter(Boolean);
    for (const offer of offers) {
      const price = String(offer?.price ?? offer?.lowPrice ?? '').trim();
      if (!product.name || !price) continue;
      const seller = String(offer?.seller?.name ?? offer?.seller ?? '').trim();
      const availability = String(offer?.availability ?? '');
      const sourceProductId = String(product?.sku ?? offer?.sku ?? product?.productID ?? '').trim();
      return {
        title: String(product.name).trim(), raw_price: price.startsWith('$') ? price : `$${price}`,
        currency: String(offer?.priceCurrency ?? 'USD').toUpperCase(),
        available: hasPositiveAvailability(availability), seller, source_product_id: sourceProductId,
        extraction_path: 'json-ld', selector_repairs: []
      };
    }
  }

  if (target.html_patterns) {
    return extractWithPatterns(html, target.html_patterns, 'saved-html-rules');
  }

  const selectors = target.selectors ?? {};
  const title = textAtFirstMatch($, selectors.title);
  const price = textAtFirstMatch($, selectors.price);
  const seller = textAtFirstMatch($, selectors.seller);
  const availability = textAtFirstMatch($, selectors.availability);
  const sku = textAtFirstMatch($, selectors.sku);
  if (!title.value || !price.value) throw new Error('Schema drift: neither JSON-LD nor saved selector fallbacks produced title and price');
  const repairs = [title, price, seller, availability, sku].flatMap(match => match.selector ? [match.selector] : []);
  return {
    title: title.value, raw_price: price.value.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] ?? price.value,
    currency: 'USD', available: hasPositiveAvailability(availability.value),
    seller: seller.value, source_product_id: sku.value, extraction_path: 'saved-selectors', selector_repairs: repairs
  };
}

async function brightDataMcpRequest(url: string, mcpUrl: string): Promise<string> {
  const client = new Client({ name: 'pricemcp-terminal-collector', version: '0.1.0' });
  try {
    await client.connect(new SSEClientTransport(new URL(mcpUrl)));
    const response = await client.callTool({ name: 'scrape_as_html', arguments: { url } });
    const text = textContent(response.content);
    const start = text.indexOf('<'), end = text.lastIndexOf('>');
    if (!response.isError && start >= 0 && end > start) return text.slice(start, end + 1);

    const fallback = await client.callTool({ name: 'scrape_as_markdown', arguments: { url } });
    if (fallback.isError) throw new Error('Bright Data MCP HTML and markdown extraction failed');
    const markdown = textContent(fallback.content);
    if (!markdown.trim()) throw new Error('Bright Data MCP returned no HTML or markdown document');
    return `${MARKDOWN_PREFIX}Source URL: ${url}\n${markdown}`;
  } finally {
    await client.close().catch(() => {});
  }
}

export async function brightDataRequest(url: string, token: string, zone: string, mcpUrl = process.env.BRIGHTDATA_MCP_URL || ''): Promise<string> {
  if(mcpUrl)return brightDataMcpRequest(url,mcpUrl);
  const response = await fetch('https://api.brightdata.com/request', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ zone, url, format: 'raw' }), signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Bright Data HTTP ${response.status} ${response.statusText}`);
  const html = await response.text();
  if (html.length < 500) throw new Error(`Bright Data returned a malformed short response (${html.length} bytes)`);
  return html;
}

export function loadBrightDataTargets(path = process.env.BRIGHTDATA_TARGETS_FILE || './config/brightdata-retailers.json'): BrightDataTarget[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(parsed?.targets)) throw new Error('Bright Data target file must contain a targets array');
  return parsed.targets.filter((target: BrightDataTarget) => target.url && target.expected_product_id);
}

export async function collectBrightDataRetailers(
  targets: BrightDataTarget[] = loadBrightDataTargets(),
  token = process.env.BRIGHTDATA_API_TOKEN || '',
  zone = process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE || '',
  mcpUrl = process.env.BRIGHTDATA_MCP_URL || ''
): Promise<CollectorResult> {
  const source = 'brightdata-retailers-us';
  const method = mcpUrl ? 'brightdata_mcp_saved_rules' : 'brightdata_web_unlocker_saved_rules';
  const observations: RawObservation[] = [], errors: string[] = [];
  if (!mcpUrl && (!token || !zone)) return { source, method, status: 'failed', observations, matched_products: 0, errors: ['BRIGHTDATA_MCP_URL or both BRIGHTDATA_API_TOKEN and BRIGHTDATA_WEB_UNLOCKER_ZONE are required'] };
  for (const target of targets) {
    try {
      if (!catalog.some(product => product.id === target.expected_product_id)) throw new Error(`Unknown expected product ${target.expected_product_id}`);
      if (!merchants.some(merchant => merchant.id === target.merchant_id)) throw new Error(`Unknown merchant ${target.merchant_id}`);
      if (!Array.isArray(target.accepted_sellers) || !target.accepted_sellers.length) throw new Error('accepted_sellers must contain at least one seller of record');
      const html = await brightDataRequest(target.url, token, zone, mcpUrl);
      const extracted = extractBrightDataProduct(html, target);
      let sellerEvidence = 'structured';
      if (!extracted.seller) {
        const host = new URL(target.url).hostname.toLowerCase();
        const hostAllowed = (target.accepted_hosts ?? []).some(value => value.toLowerCase() === host);
        const markerFound = (target.seller_markers ?? []).some(marker => html.toLowerCase().includes(marker.toLowerCase()));
        if (hostAllowed && markerFound) {
          extracted.seller = target.merchant_name;
          sellerEvidence = 'first-party-host-marker';
        }
      }
      const sellerAllowed = target.accepted_sellers.some(seller => seller.toLowerCase() === extracted.seller.toLowerCase());
      if (!sellerAllowed) throw new Error(`Rejected seller of record: ${extracted.seller || 'unknown'}`);
      if (!extracted.source_product_id || extracted.source_product_id.toLowerCase() !== target.source_product_id.trim().toLowerCase()) {
        throw new Error(`Rejected retailer SKU: expected ${target.source_product_id}, observed ${extracted.source_product_id || 'unknown'}`);
      }
      const matched = matchProduct(extracted.title, catalog), exact = matched.product?.id === target.expected_product_id;
      observations.push({
        source, source_method: method, merchant_id: target.merchant_id, source_product_id: target.source_product_id,
        url: target.url, observed_at: new Date().toISOString(), title: extracted.title, raw_price: extracted.raw_price,
        currency: extracted.currency, price_minor: parsePrice(extracted.raw_price, extracted.currency), shipping_minor: null,
        available: extracted.available, condition: 'new', matched_product_id: exact ? target.expected_product_id : null,
        match_confidence: exact ? matched.confidence : 0, collection_status: exact ? (extracted.available ? 'success' : 'unavailable') : 'unmatched',
        raw_payload: { provider: 'bright-data', merchant_name: target.merchant_name, seller_of_record: extracted.seller, seller_evidence: sellerEvidence, extraction_path: extracted.extraction_path, selector_repairs: extracted.selector_repairs, expected_product_id: target.expected_product_id }
      });
    } catch (error) { errors.push(`${target.merchant_name} ${target.url}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { source, method, status: errors.length ? (observations.length ? 'partial' : 'failed') : 'success', observations, matched_products: new Set(observations.filter(item => item.matched_product_id).map(item => item.matched_product_id)).size, errors };
}
