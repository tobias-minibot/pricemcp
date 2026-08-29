import { afterEach,describe,expect,it,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectAmazon,collectApple,collectorInternals } from '../src/collectors.js';

const fixture=(name:string)=>readFileSync(new URL(`fixtures/${name}`,import.meta.url),'utf8');

afterEach(()=>vi.unstubAllGlobals());
describe('collector failure handling',()=>{
  it('records HTTP failures instead of fabricating observations',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('blocked',{status:403})));const r=await collectAmazon();expect(r.status).toBe('failed');expect(r.observations).toHaveLength(0);expect(r.errors[0]).toContain('HTTP 403')});
  it('records malformed payloads as a failed run',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>'+('x'.repeat(600))+'</html>',{status:200})));const r=await collectApple();expect(r.status).toBe('failed');expect(r.errors[0]).toContain('bootstrap not found')});
  it('extracts only the primary new-condition Amazon buy box',()=>{const html=`<html><body><span id="productTitle">Apple 2026 MacBook Air 13-inch Laptop with M5 chip, 13.6-inch, 16GB Unified Memory, 512GB SSD</span><div id="corePriceDisplay_desktop_feature_div"><span id="apex-pricetopay-accessibility-label">$1,299.00</span></div><div id="sfsb_accordion_head">Ships from: Amazon.com Sold by: Amazon.com</div><input id="add-to-cart-button"></body></html>`;expect(collectorInternals.parseAmazonPdp(html)).toEqual({title:'Apple 2026 MacBook Air 13-inch Laptop with M5 chip, 13.6-inch, 16GB Unified Memory, 512GB SSD',raw_price:'$1,299.00',seller:'Amazon.com',ships_from:'Amazon.com',available:true})});
  it('rejects a third-party Amazon marketplace buy box',async()=>{const html=`<html><body>${'x'.repeat(600)}<span id="productTitle">Apple 2026 MacBook Air 13-inch Laptop with M5 chip, 13.6-inch, 16GB Unified Memory, 512GB SSD</span><div id="corePriceDisplay_desktop_feature_div"><span id="apex-pricetopay-accessibility-label">$999.00</span></div><div id="sfsb_accordion_head">Ships from: Amazon Sold by: Unknown Deals LLC</div><input id="add-to-cart-button"></body></html>`;vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(html,{status:200})));const r=await collectAmazon();expect(r.status).toBe('failed');expect(r.observations).toHaveLength(0);expect(r.errors[0]).toContain('Rejected non-Amazon seller')});
  it('keeps saved Apple and Best Buy source contracts readable',()=>{const apple=collectorInternals.parseAppleBootstrap(fixture('apple-product-selection.html'));expect(apple.products[0].btrOrFdPartNumber).toBe('TEST1');const bestBuy=collectorInternals.parseBestBuyTransport(fixture('bestbuy-search.html'));expect(bestBuy[0]).toMatchObject({skuId:'123',brand:'Apple'})});
});
