import type { CatalogProduct, FreshnessStatus } from './types.js';

export function normalizeText(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parsePrice(input: string, currency = 'USD'): number {
  if (currency !== 'USD') throw new Error(`Unsupported currency: ${currency}`);
  const cleaned = input.replace(/[^0-9.,-]/g, '');
  if (!cleaned) throw new Error('Missing numeric price');
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(/,/g, '')
    : cleaned.replace(/,/g, '');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) throw new Error(`Malformed price: ${input}`);
  return Math.round(value * 100);
}

export function freshness(observedAt: string, now = new Date()): { age_seconds: number; freshness_status: FreshnessStatus } {
  const age = Math.max(0, Math.floor((now.getTime() - new Date(observedAt).getTime()) / 1000));
  const status: FreshnessStatus = age < 3600 ? 'fresh' : age < 21600 ? 'recent' : age < 86400 ? 'aging' : 'stale';
  return { age_seconds: age, freshness_status: status };
}

const attributePatterns: Array<[string, RegExp]> = [
  ['chip', /\b(m[1-9](?:\s+(?:pro|max|ultra))?|a\d{2}(?:\s+pro)?)\b/i],
  ['memory_gb', /\b(\d{1,3})\s*gb\s+(?:unified\s+)?(?:memory|ram)\b/i],
  ['storage_gb', /\b(\d+(?:\.\d+)?)\s*(tb|gb)\s+(?:ssd|storage)\b/i],
  ['display_inches', /\b(\d{1,2}(?:\.\d)?)\s*(?:-|\s)?inch\b/i]
];

export function extractAttributes(title: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, re] of attributePatterns) {
    const match = title.match(re);
    if (!match) continue;
    if (key === 'memory_gb') out[key] = Number(match[1]);
    else if (key === 'storage_gb') out[key] = Math.round(Number(match[1]) * (match[2]?.toLowerCase() === 'tb' ? 1024 : 1));
    else if (key === 'display_inches') out[key] = Number(match[1]);
    else out[key] = match[1]!.toUpperCase().replace(/\s+/g, ' ');
  }
  const airpodsGeneration=title.match(/\bairpods(?:\s+(?:pro|max))?(?:\s*(\d+)(?:st|nd|rd|th)?\b|.{0,80}?\b(\d+)(?:st|nd|rd|th)?\s+generation\b)/i);
  if(airpodsGeneration)out.generation=Number(airpodsGeneration[1]??airpodsGeneration[2]);
  if(/\b(?:active noise cancellation|anc)\b/i.test(title))out.anc=true;
  const caseSize=title.match(/\b(4[0269])\s*mm\b/i);
  if(caseSize)out.case_mm=Number(caseSize[1]);
  return out;
}

export function matchProduct(title: string, products: CatalogProduct[]): { product: CatalogProduct | null; confidence: number } {
  const text = normalizeText(title);
  const attrs = extractAttributes(title);
  let best: CatalogProduct | null = null;
  let bestScore = 0;
  for (const product of products) {
    const familyTokens = normalizeText(product.family).split(' ');
    if (!familyTokens.every(t => text.includes(t))) continue;
    let score = 0.45;
    if(text.includes(normalizeText(product.family)))score+=0.12;
    let conflicts = 0, matchedExpected = 0;
    const expected = product.attributes;
    for (const key of ['chip', 'memory_gb', 'storage_gb', 'display_inches', 'generation', 'anc', 'case_mm']) {
      if (attrs[key] === undefined || expected[key] === undefined) continue;
      const same = String(attrs[key]).toUpperCase() === String(expected[key]).toUpperCase();
      score += same ? 0.13 : 0;
      matchedExpected += same ? 1 : 0;
      conflicts += same ? 0 : 1;
    }
    if(matchedExpected&&conflicts===0)score+=0.12;
    if (conflicts) score -= conflicts * 0.35;
    if (product.aliases.some(a => text.includes(normalizeText(a)))) score += 0.08;
    if (score > bestScore) { best = product; bestScore = score; }
  }
  return bestScore >= 0.7 - 1e-9 ? { product: best, confidence: Math.min(0.99, bestScore) } : { product: null, confidence: Math.max(0, bestScore) };
}
