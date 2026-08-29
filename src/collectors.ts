import * as cheerio from 'cheerio';
import { catalog } from './catalog.js';
import { matchProduct, parsePrice } from './normalize.js';
import type { CollectorResult, RawObservation } from './types.js';

const UA = 'PriceMCP/0.1 (+local prototype; respectful low-rate collector)';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const text = await response.text();
  if (text.length < 500) throw new Error(`Malformed short response (${text.length} bytes)`);
  return text;
}

function result(source: string, method: string, observations: RawObservation[], errors: string[]): CollectorResult {
  return { source, method, status: errors.length ? (observations.length ? 'partial' : 'failed') : 'success', observations,
    matched_products: new Set(observations.filter(o=>o.matched_product_id).map(o=>o.matched_product_id)).size, errors };
}

export async function collectApple(): Promise<CollectorResult> {
  const source='apple-us', method='curated_product_selection_bootstrap';
  const observed_at=new Date().toISOString(), observations:RawObservation[]=[], errors:string[]=[];
  for(const page of appleTargets){
    try{
      const data=parseAppleBootstrap(await fetchText(page.url));
      for(const target of page.targets){
        const candidates=(data.products||[]).filter(target.accept).filter((entry:any)=>Number.isFinite(Number(data.mainDisplayValues?.prices?.[entry.priceKey]?.currentPrice?.raw_amount)));
        candidates.sort((a:any,b:any)=>Number(data.mainDisplayValues.prices[a.priceKey].currentPrice.raw_amount)-Number(data.mainDisplayValues.prices[b.priceKey].currentPrice.raw_amount));
        const entry=candidates[0];if(!entry)throw new Error(`${target.productId}: expected configuration not found`);
        const product=catalog.find(p=>p.id===target.productId);if(!product)throw new Error(`${target.productId}: catalog target missing`);
        const price=data.mainDisplayValues.prices[entry.priceKey].currentPrice.raw_amount;
        observations.push({source,source_method:method,merchant_id:'apple',source_product_id:entry.btrOrFdPartNumber||entry.aosContainerPartNumber||entry.priceKey,url:page.url,observed_at,title:`Apple ${product.name}`,raw_price:`$${price}`,currency:'USD',price_minor:parsePrice(price),shipping_minor:null,available:!entry.isComingSoon,condition:'new',matched_product_id:product.id,match_confidence:1,collection_status:entry.isComingSoon?'unavailable':'success',raw_payload:{price_key:entry.priceKey,part_number:entry.btrOrFdPartNumber||entry.aosContainerPartNumber,dimensions:entry.dimensions}});
      }
    }catch(e){errors.push(`${page.url}: ${e instanceof Error?e.message:String(e)}`)}
  }
  return result(source,method,observations,errors);
}

function parseAppleBootstrap(html:string):any{
  const $=cheerio.load(html);let script='';
  $('script').each((_i,e)=>{const text=$(e).html()||'';if(text.includes('PRODUCT_SELECTION_BOOTSTRAP'))script=text});
  const match=script.match(/productSelectionData:\s*(\{[\s\S]*\})\s*\n\s*\}/);
  if(!match)throw new Error('Apple product bootstrap not found');
  const data=JSON.parse(match[1]!);if(!Array.isArray(data.products)||!data.mainDisplayValues?.prices)throw new Error('Apple bootstrap schema drift');
  return data;
}

const dim=(entry:any,key:string)=>String(entry.dimensions?.[key]||'').toLowerCase();
const screen=(entry:any)=>Number(dim(entry,'chassis-dimensionScreensize').replace(/\D/g,''));
const appleTargets=[
  {url:'https://www.apple.com/shop/buy-mac/macbook-air',targets:[
    {productId:'apple-macbook-air-m5-13-16-512',accept:(e:any)=>screen(e)===13},
    {productId:'apple-macbook-air-m5-15-16-512',accept:(e:any)=>screen(e)===15}
  ]},
  {url:'https://www.apple.com/shop/buy-mac/macbook-pro',targets:[
    {productId:'apple-macbook-pro-m5-14-16-1024',accept:(e:any)=>screen(e)===14&&dim(e,'processor-dimensionChip')==='m5'},
    {productId:'apple-macbook-pro-m5-pro-14-24-1024',accept:(e:any)=>screen(e)===14&&dim(e,'processor-dimensionChip')==='m5pro'},
    {productId:'apple-macbook-pro-m5-pro-16-24-1024',accept:(e:any)=>screen(e)===16&&dim(e,'processor-dimensionChip')==='m5pro'}
  ]},
  {url:'https://www.apple.com/shop/buy-mac/mac-mini',targets:[
    {productId:'apple-mac-mini-m6-16-256',accept:(e:any)=>dim(e,'processor-dimensionChip')==='m6'},
    {productId:'apple-mac-mini-m5-pro-24-512',accept:(e:any)=>dim(e,'processor-dimensionChip')==='m5pro'}
  ]},
  {url:'https://www.apple.com/shop/buy-mac/imac',targets:[
    {productId:'apple-imac-m4-24-16-256',accept:(e:any)=>dim(e,'processor-cpuCoreCount-gpuCoreCount')==='8-8'},
    {productId:'apple-imac-m4-24-16-512',accept:(e:any)=>dim(e,'processor-cpuCoreCount-gpuCoreCount')==='10-10'}
  ]}
];

function parseBestBuyTransport(html:string):any[]{
  const $=cheerio.load(html), found:any[]=[], visited=new Set<any>();
  const walk=(x:any)=>{if(!x||typeof x!=='object'||visited.has(x))return;visited.add(x);if(x.__typename==='SearchProduct'&&x.product)found.push(x.product);for(const v of Object.values(x))walk(v)};
  $('script').each((_i,e)=>{const text=$(e).html()||'';if(!text.includes('ApolloSSRDataTransport'))return;const match=text.match(/\.push\((\{[\s\S]*\})\);?\s*$/);if(!match)return;try{walk(JSON.parse(match[1]!.replace(/:undefined(?=[,}])/g,':null').replace(/\[undefined\]/g,'[null]')))}catch{/* other hydration blocks can contain executable JS */}});
  return found;
}

export async function collectBestBuy():Promise<CollectorResult>{
  if(process.env.BESTBUY_API_KEY)return collectBestBuyOfficial(process.env.BESTBUY_API_KEY);
  const source='best-buy-us',method='embedded_apollo_ssr',observed_at=new Date().toISOString(),observations:RawObservation[]=[],errors:string[]=[];
  const queries=['apple macbook air','apple macbook pro','apple airpods pro']; const seen=new Set<string>();
  for(const query of queries){
    const searchUrl=`https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`;
    try{
      const html=await fetchText(searchUrl);
      for(const p of parseBestBuyTransport(html)){
        if(seen.has(p.skuId)||p.brand!=='Apple'||p.seller?.classification!=='1P')continue;seen.add(p.skuId);
        const title=p.name?.short||p.name?.title||''; if(/refurbished|renewed|open.box/i.test(title))continue;
        const price=p.price?.customerPrice; if(!Number.isFinite(price))continue;
        const matched=matchProduct(title,catalog); const button=p.fulfillmentOptions?.buttonStates?.[0]?.buttonState;
        observations.push({source,source_method:method,merchant_id:'best-buy',source_product_id:String(p.skuId),url:p.url?.skuSpecificUrl||p.url?.pdp||searchUrl,observed_at,title,raw_price:`$${price}`,currency:'USD',price_minor:Math.round(price*100),shipping_minor:null,available:button==='ADD_TO_CART',condition:'new',matched_product_id:matched.product?.id,match_confidence:matched.confidence,collection_status:matched.product?(button==='ADD_TO_CART'?'success':'unavailable'):'unmatched',raw_payload:{sku:p.skuId,model:p.manufacturer?.modelNumber,seller:p.seller?.classification,display_status:p.dotComDisplayStatus,button_state:button}});
      }
    }catch(e){errors.push(`${query}: ${e instanceof Error?e.message:String(e)}`)}
  }
  return result(source,method,observations,errors);
}

const bestBuyExactSkus=[
  ['6397846','apple-macbook-air-m5-13-16-512'],['6571043','apple-macbook-air-m5-15-16-512'],
  ['6565872','apple-macbook-pro-m5-14-16-1024'],['6615860','apple-macbook-pro-m5-pro-14-24-1024'],
  ['6615870','apple-macbook-pro-m5-pro-16-24-1024'],['6615872','apple-macbook-pro-m5-pro-16-48-1024'],
  ['6455384','apple-macbook-air-m5-13-24-1024'],['6571045','apple-macbook-air-m5-15-24-1024'],
  ['6376563','apple-airpods-pro-3'],['6550081','apple-airpods-max-2']
] as const;

export async function collectBestBuyOfficial(apiKey:string):Promise<CollectorResult>{
  const source='best-buy-us',method='official_products_api',observed_at=new Date().toISOString(),observations:RawObservation[]=[],errors:string[]=[];
  for(const [sku,expectedId] of bestBuyExactSkus){
    const url=`https://api.bestbuy.com/v1/products/${sku}.json?show=sku,name,salePrice,regularPrice,onlineAvailability,orderable,url,seller&apiKey=${encodeURIComponent(apiKey)}`;
    try{
      const response=await fetch(url,{headers:{'user-agent':UA},signal:AbortSignal.timeout(20_000)});if(!response.ok)throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const p:any=await response.json();const price=Number(p.salePrice??p.regularPrice);if(!p.name||!Number.isFinite(price))throw new Error('Malformed official API product');
      const matched=matchProduct(p.name,catalog),exact=matched.product?.id===expectedId;
      observations.push({source,source_method:method,merchant_id:'best-buy',source_product_id:sku,url:p.url||`https://www.bestbuy.com/site/${sku}.p`,observed_at,title:p.name,raw_price:`$${price}`,currency:'USD',price_minor:Math.round(price*100),shipping_minor:null,available:Boolean(p.onlineAvailability&&p.orderable!==false),condition:'new',matched_product_id:exact?expectedId:null,match_confidence:exact?matched.confidence:0,collection_status:exact?(p.onlineAvailability?'success':'unavailable'):'unmatched',raw_payload:{sku,onlineAvailability:p.onlineAvailability,orderable:p.orderable,seller:p.seller||null}});
    }catch(e){errors.push(`${sku}: ${e instanceof Error?e.message:String(e)}`)}
  }
  return result(source,method,observations,errors);
}

const amazonProducts = [
  { asin:'B0GR1493ZV', expected_product_id:'apple-macbook-air-m5-13-16-512' }
];

function parseAmazonPdp(html:string):{title:string;raw_price:string;seller:string;ships_from:string;available:boolean}{
  const $=cheerio.load(html);
  const title=$('#productTitle').first().text().trim();
  const rawPrice=$('#corePriceDisplay_desktop_feature_div #apex-pricetopay-accessibility-label').first().text().trim().match(/\$[\d,]+(?:\.\d{2})?/)?.[0]||'';
  const fulfillment=$('#sfsb_accordion_head').first().text().replace(/\s+/g,' ').trim();
  const seller=fulfillment.match(/Sold by:\s*(.+)$/i)?.[1]?.trim()||'';
  const shipsFrom=fulfillment.match(/Ships from:\s*(.*?)\s+Sold by:/i)?.[1]?.trim()||'';
  return {title,raw_price:rawPrice,seller,ships_from:shipsFrom,available:$('#add-to-cart-button').length>0};
}

export async function collectAmazon():Promise<CollectorResult>{
  const source='amazon-us',method='curated_pdp_html',observed_at=new Date().toISOString(),observations:RawObservation[]=[],errors:string[]=[];
  for(const item of amazonProducts){
    const url=`https://www.amazon.com/dp/${item.asin}`;
    try{
      const parsed=parseAmazonPdp(await fetchText(url));
      if(!parsed.title||!parsed.raw_price)throw new Error('Product title or primary new-condition price not found');
      if(parsed.seller.toLowerCase()!=='amazon.com')throw new Error(`Rejected non-Amazon seller: ${parsed.seller||'unknown'}`);
      const matched=matchProduct(parsed.title,catalog);
      const exactMatch=matched.product?.id===item.expected_product_id;
      observations.push({source,source_method:method,merchant_id:'amazon',source_product_id:item.asin,url,observed_at,title:parsed.title,raw_price:parsed.raw_price,currency:'USD',price_minor:parsePrice(parsed.raw_price),shipping_minor:null,available:parsed.available,condition:'new',matched_product_id:exactMatch?matched.product!.id:null,match_confidence:exactMatch?matched.confidence:0,collection_status:exactMatch?(parsed.available?'success':'unavailable'):'unmatched',raw_payload:{asin:item.asin,seller:parsed.seller,ships_from:parsed.ships_from,expected_product_id:item.expected_product_id}});
    }catch(e){errors.push(`${item.asin}: ${e instanceof Error?e.message:String(e)}`)}
  }
  return result(source,method,observations,errors);
}

export async function runCollectors():Promise<CollectorResult[]>{
  return Promise.all([collectApple(),collectBestBuy(),collectAmazon()]);
}

export async function runPriorityCollectors():Promise<CollectorResult[]>{
  return Promise.all([collectApple(),collectBestBuy()]);
}

export const collectorInternals={parseAppleBootstrap,parseBestBuyTransport,parseAmazonPdp,fetchText};
