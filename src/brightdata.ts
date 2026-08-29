import * as cheerio from 'cheerio';
import { readFileSync } from 'node:fs';
import { catalog } from './catalog.js';
import { matchProduct, parsePrice } from './normalize.js';
import type { CollectorResult, RawObservation } from './types.js';

export interface BrightDataTarget {
  merchant_id: string;
  merchant_name: string;
  url: string;
  expected_product_id: string;
  source_product_id: string;
  accepted_sellers: string[];
  selectors?: {
    title?: string[];
    price?: string[];
    availability?: string[];
    seller?: string[];
  };
}

type ExtractedProduct = {
  title: string;
  raw_price: string;
  currency: string;
  available: boolean;
  seller: string;
  extraction_path: 'json-ld' | 'saved-selectors';
  selector_repairs: string[];
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

export function extractBrightDataProduct(html: string, target: BrightDataTarget): ExtractedProduct {
  const $ = cheerio.load(html);
  for (const product of jsonLdProducts($)) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers].filter(Boolean);
    for (const offer of offers) {
      const price = String(offer?.price ?? offer?.lowPrice ?? '').trim();
      if (!product.name || !price) continue;
      const seller = String(offer?.seller?.name ?? offer?.seller ?? product?.brand?.name ?? '').trim();
      const availability = String(offer?.availability ?? '').toLowerCase();
      return {
        title: String(product.name).trim(), raw_price: price.startsWith('$') ? price : `$${price}`,
        currency: String(offer?.priceCurrency ?? 'USD').toUpperCase(),
        available: !/outofstock|soldout|discontinued/.test(availability), seller,
        extraction_path: 'json-ld', selector_repairs: []
      };
    }
  }

  const selectors = target.selectors ?? {};
  const title = textAtFirstMatch($, selectors.title);
  const price = textAtFirstMatch($, selectors.price);
  const seller = textAtFirstMatch($, selectors.seller);
  const availability = textAtFirstMatch($, selectors.availability);
  if (!title.value || !price.value) throw new Error('Schema drift: neither JSON-LD nor saved selector fallbacks produced title and price');
  const repairs = [title, price, seller, availability].flatMap(match => match.selector ? [match.selector] : []);
  return {
    title: title.value, raw_price: price.value.match(/\$[\d,]+(?:\.\d{2})?/)?.[0] ?? price.value,
    currency: 'USD', available: !/out of stock|sold out|unavailable/i.test(availability.value),
    seller: seller.value, extraction_path: 'saved-selectors', selector_repairs: repairs
  };
}

export async function brightDataRequest(url: string, token: string, zone: string): Promise<string> {
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
  zone = process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE || ''
): Promise<CollectorResult> {
  const source = 'brightdata-retailers-us', method = 'brightdata_web_unlocker_saved_rules';
  const observations: RawObservation[] = [], errors: string[] = [];
  if (!token || !zone) return { source, method, status: 'failed', observations, matched_products: 0, errors: ['BRIGHTDATA_API_TOKEN and BRIGHTDATA_WEB_UNLOCKER_ZONE are required'] };
  for (const target of targets) {
    try {
      if (!catalog.some(product => product.id === target.expected_product_id)) throw new Error(`Unknown expected product ${target.expected_product_id}`);
      const extracted = extractBrightDataProduct(await brightDataRequest(target.url, token, zone), target);
      const sellerAllowed = target.accepted_sellers.some(seller => seller.toLowerCase() === extracted.seller.toLowerCase());
      if (!sellerAllowed) throw new Error(`Rejected seller of record: ${extracted.seller || 'unknown'}`);
      const matched = matchProduct(extracted.title, catalog), exact = matched.product?.id === target.expected_product_id;
      observations.push({
        source, source_method: method, merchant_id: target.merchant_id, source_product_id: target.source_product_id,
        url: target.url, observed_at: new Date().toISOString(), title: extracted.title, raw_price: extracted.raw_price,
        currency: extracted.currency, price_minor: parsePrice(extracted.raw_price), shipping_minor: null,
        available: extracted.available, condition: 'new', matched_product_id: exact ? target.expected_product_id : null,
        match_confidence: exact ? matched.confidence : 0, collection_status: exact ? (extracted.available ? 'success' : 'unavailable') : 'unmatched',
        raw_payload: { provider: 'bright-data', merchant_name: target.merchant_name, seller_of_record: extracted.seller, extraction_path: extracted.extraction_path, selector_repairs: extracted.selector_repairs, expected_product_id: target.expected_product_id }
      });
    } catch (error) { errors.push(`${target.merchant_name} ${target.url}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { source, method, status: errors.length ? (observations.length ? 'partial' : 'failed') : 'success', observations, matched_products: new Set(observations.filter(item => item.matched_product_id).map(item => item.matched_product_id)).size, errors };
}
