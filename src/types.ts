export type FreshnessStatus = 'fresh' | 'recent' | 'aging' | 'stale';

export interface CatalogProduct {
  id: string;
  brand: string;
  category: string;
  family: string;
  name: string;
  model?: string;
  attributes: Record<string, string | number | boolean>;
  official_url: string;
  priority: 'priority' | 'normal';
  active: boolean;
  aliases: string[];
  dataset?: string;
  synthetic?: boolean;
}

export interface RawObservation {
  source: string;
  source_method: string;
  merchant_id: string;
  source_product_id: string;
  url: string;
  observed_at: string;
  title: string;
  raw_price: string;
  currency: string;
  price_minor: number;
  shipping_minor?: number | null;
  available: boolean;
  condition: string;
  membership_required?: boolean;
  matched_product_id?: string | null;
  match_confidence: number;
  collection_status: 'success' | 'unavailable' | 'unmatched' | 'malformed';
  raw_payload?: unknown;
  dataset?: string;
  synthetic?: boolean;
}

export interface MerchantSeed {
  id: string;
  name: string;
  verified: boolean;
  authorized: boolean;
  trust_score: number;
  source_type: 'official' | 'retailer' | 'marketplace';
  shipping_reliability: number;
  marketplace_seller: boolean;
  notes: string;
}

export interface CollectorResult {
  source: string;
  method: string;
  status: 'success' | 'partial' | 'failed';
  observations: RawObservation[];
  matched_products: number;
  errors: string[];
}
