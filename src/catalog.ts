import type { CatalogProduct, MerchantSeed } from './types.js';

const p = (id: string, category: string, family: string, suffix: string, attributes: CatalogProduct['attributes'], url: string, active = true, priority: CatalogProduct['priority'] = 'normal'): CatalogProduct => ({
  id, brand: 'Apple', category, family, name: `${family} ${suffix}`.trim(), attributes,
  official_url: url, active, priority, aliases: [id.replace(/-/g, ' '), `${family} ${suffix}`]
});

export const catalog: CatalogProduct[] = [
  p('apple-macbook-air-m4-13-16-256','laptop','MacBook Air','M4 13-inch 16GB/256GB',{chip:'M4',display_inches:13,memory_gb:16,storage_gb:256},'https://www.apple.com/newsroom/2025/03/apple-introduces-the-new-macbook-air-with-the-m4-chip-and-a-sky-blue-color/',false,'priority'),
  p('apple-macbook-air-m5-13-16-512','laptop','MacBook Air','M5 13-inch 16GB/512GB',{chip:'M5',display_inches:13,memory_gb:16,storage_gb:512},'https://www.apple.com/shop/buy-mac/macbook-air',true,'priority'),
  p('apple-macbook-air-m5-13-16-1024','laptop','MacBook Air','M5 13-inch 16GB/1TB',{chip:'M5',display_inches:13,memory_gb:16,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-air'),
  p('apple-macbook-air-m5-13-24-1024','laptop','MacBook Air','M5 13-inch 24GB/1TB',{chip:'M5',display_inches:13,memory_gb:24,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-air'),
  p('apple-macbook-air-m5-15-16-512','laptop','MacBook Air','M5 15-inch 16GB/512GB',{chip:'M5',display_inches:15,memory_gb:16,storage_gb:512},'https://www.apple.com/shop/buy-mac/macbook-air'),
  p('apple-macbook-air-m5-15-16-1024','laptop','MacBook Air','M5 15-inch 16GB/1TB',{chip:'M5',display_inches:15,memory_gb:16,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-air'),
  p('apple-macbook-air-m5-15-24-1024','laptop','MacBook Air','M5 15-inch 24GB/1TB',{chip:'M5',display_inches:15,memory_gb:24,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-air'),
  p('apple-macbook-pro-m5-14-16-1024','laptop','MacBook Pro','M5 14-inch 16GB/1TB',{chip:'M5',display_inches:14,memory_gb:16,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-pro',true,'priority'),
  p('apple-macbook-pro-m5-14-24-1024','laptop','MacBook Pro','M5 14-inch 24GB/1TB',{chip:'M5',display_inches:14,memory_gb:24,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-pro'),
  p('apple-macbook-pro-m5-pro-14-24-1024','laptop','MacBook Pro','M5 Pro 14-inch 24GB/1TB',{chip:'M5 PRO',display_inches:14,memory_gb:24,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-pro'),
  p('apple-macbook-pro-m5-pro-16-24-1024','laptop','MacBook Pro','M5 Pro 16-inch 24GB/1TB',{chip:'M5 PRO',display_inches:16,memory_gb:24,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-pro'),
  p('apple-macbook-pro-m5-pro-16-48-1024','laptop','MacBook Pro','M5 Pro 16-inch 48GB/1TB',{chip:'M5 PRO',display_inches:16,memory_gb:48,storage_gb:1024},'https://www.apple.com/shop/buy-mac/macbook-pro'),
  p('apple-mac-mini-m6-16-256','desktop','Mac mini','M6 16GB/256GB',{chip:'M6',memory_gb:16,storage_gb:256},'https://www.apple.com/shop/buy-mac/mac-mini'),
  p('apple-mac-mini-m6-16-512','desktop','Mac mini','M6 16GB/512GB',{chip:'M6',memory_gb:16,storage_gb:512},'https://www.apple.com/shop/buy-mac/mac-mini'),
  p('apple-mac-mini-m5-pro-24-512','desktop','Mac mini','M5 Pro 24GB/512GB',{chip:'M5 PRO',memory_gb:24,storage_gb:512},'https://www.apple.com/shop/buy-mac/mac-mini'),
  p('apple-imac-m4-24-16-256','desktop','iMac','M4 24-inch 16GB/256GB',{chip:'M4',display_inches:24,memory_gb:16,storage_gb:256},'https://www.apple.com/shop/buy-mac/imac'),
  p('apple-imac-m4-24-16-512','desktop','iMac','M4 24-inch 16GB/512GB',{chip:'M4',display_inches:24,memory_gb:16,storage_gb:512},'https://www.apple.com/shop/buy-mac/imac'),
  p('apple-iphone-17-256','phone','iPhone 17','256GB',{storage_gb:256},'https://www.apple.com/shop/buy-iphone/iphone-17'),
  p('apple-iphone-air-256','phone','iPhone Air','256GB',{storage_gb:256},'https://www.apple.com/shop/buy-iphone/iphone-air'),
  p('apple-iphone-17-pro-256','phone','iPhone 17 Pro','256GB',{storage_gb:256},'https://www.apple.com/shop/buy-iphone/iphone-17-pro'),
  p('apple-iphone-17-pro-max-256','phone','iPhone 17 Pro Max','256GB',{storage_gb:256},'https://www.apple.com/shop/buy-iphone/iphone-17-pro'),
  p('apple-iphone-17e-128','phone','iPhone 17e','128GB',{storage_gb:128},'https://www.apple.com/shop/buy-iphone/iphone-17e'),
  p('apple-ipad-pro-m5-11-256','tablet','iPad Pro','M5 11-inch 256GB',{chip:'M5',display_inches:11,storage_gb:256},'https://www.apple.com/shop/buy-ipad/ipad-pro'),
  p('apple-ipad-pro-m5-13-256','tablet','iPad Pro','M5 13-inch 256GB',{chip:'M5',display_inches:13,storage_gb:256},'https://www.apple.com/shop/buy-ipad/ipad-pro'),
  p('apple-ipad-air-m4-11-128','tablet','iPad Air','M4 11-inch 128GB',{chip:'M4',display_inches:11,storage_gb:128},'https://www.apple.com/shop/buy-ipad/ipad-air'),
  p('apple-ipad-air-m4-13-128','tablet','iPad Air','M4 13-inch 128GB',{chip:'M4',display_inches:13,storage_gb:128},'https://www.apple.com/shop/buy-ipad/ipad-air'),
  p('apple-ipad-a16-128','tablet','iPad','A16 128GB',{chip:'A16',storage_gb:128},'https://www.apple.com/shop/buy-ipad/ipad'),
  p('apple-ipad-mini-a17-pro-128','tablet','iPad mini','A17 Pro 128GB',{chip:'A17 PRO',storage_gb:128},'https://www.apple.com/shop/buy-ipad/ipad-mini'),
  p('apple-watch-series-11-42','wearable','Apple Watch Series 11','42mm',{case_mm:42},'https://www.apple.com/shop/buy-watch/apple-watch'),
  p('apple-watch-series-11-46','wearable','Apple Watch Series 11','46mm',{case_mm:46},'https://www.apple.com/shop/buy-watch/apple-watch'),
  p('apple-watch-ultra-3-49','wearable','Apple Watch Ultra 3','49mm',{case_mm:49},'https://www.apple.com/shop/buy-watch/apple-watch-ultra'),
  p('apple-watch-se-3-40','wearable','Apple Watch SE 3','40mm',{case_mm:40},'https://www.apple.com/shop/buy-watch/apple-watch-se'),
  p('apple-airpods-pro-3','audio','AirPods Pro 3','',{generation:3},'https://www.apple.com/shop/product/MFHP4LL/A/airpods-pro-3'),
  p('apple-airpods-4-anc','audio','AirPods 4','with Active Noise Cancellation',{generation:4,anc:true},'https://www.apple.com/shop/product/MXP93LL/A/airpods-4-with-active-noise-cancellation'),
  p('apple-airpods-max-2','audio','AirPods Max 2','',{generation:2},'https://www.apple.com/airpods-max/'),
  p('apple-vision-pro-m5-256','spatial_computer','Apple Vision Pro','M5 256GB',{chip:'M5',storage_gb:256},'https://www.apple.com/shop/buy-vision/apple-vision-pro'),
  p('apple-vision-pro-m5-512','spatial_computer','Apple Vision Pro','M5 512GB',{chip:'M5',storage_gb:512},'https://www.apple.com/shop/buy-vision/apple-vision-pro'),
  p('apple-vision-pro-m5-1024','spatial_computer','Apple Vision Pro','M5 1TB',{chip:'M5',storage_gb:1024},'https://www.apple.com/shop/buy-vision/apple-vision-pro')
];

export const merchants: MerchantSeed[] = [
  { id:'apple', name:'Apple', verified:true, authorized:true, trust_score:1, source_type:'official', shipping_reliability:0.98, marketplace_seller:false, notes:'Manufacturer direct; official-price reference.' },
  { id:'best-buy', name:'Best Buy', verified:true, authorized:true, trust_score:0.94, source_type:'retailer', shipping_reliability:0.94, marketplace_seller:false, notes:'Only Best Buy first-party (seller classification 1P) offers are accepted.' },
  { id:'amazon', name:'Amazon.com', verified:true, authorized:true, trust_score:0.95, source_type:'retailer', shipping_reliability:0.95, marketplace_seller:false, notes:'Only curated PDP offers explicitly sold by Amazon.com are accepted; third-party marketplace sellers are rejected.' },
  { id:'walmart', name:'Walmart', verified:false, authorized:false, trust_score:0.70, source_type:'marketplace', shipping_reliability:0.90, marketplace_seller:false, notes:'Bright Data candidate. Only Walmart.com seller-of-record PDPs may be ingested; remains untrusted until live evidence and authorization are verified.' },
  { id:'target', name:'Target', verified:false, authorized:false, trust_score:0.70, source_type:'retailer', shipping_reliability:0.90, marketplace_seller:false, notes:'Bright Data candidate; remains untrusted until live evidence and authorization are verified.' },
  { id:'bh-photo', name:'B&H Photo', verified:false, authorized:false, trust_score:0.70, source_type:'retailer', shipping_reliability:0.90, marketplace_seller:false, notes:'Bright Data candidate; remains untrusted until live evidence and authorization are verified.' },
  { id:'adorama', name:'Adorama', verified:false, authorized:false, trust_score:0.70, source_type:'retailer', shipping_reliability:0.90, marketplace_seller:false, notes:'Bright Data candidate; remains untrusted until live evidence and authorization are verified.' }
];
