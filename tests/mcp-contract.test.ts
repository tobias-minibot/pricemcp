import { describe,expect,it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { openDatabase,seed,appendObservation } from '../src/db.js';
import { createMcpServer } from '../src/mcp.js';

const MBA='apple-macbook-air-m5-13-16-512';
const connect=async()=>{const db=openDatabase(':memory:');seed(db);appendObservation(db,null,{source:'test',source_method:'fixture',merchant_id:'apple',source_product_id:'sku',url:'https://apple.com/test',observed_at:new Date().toISOString(),title:'MacBook Air M5',raw_price:'$1,299.00',currency:'USD',price_minor:129900,shipping_minor:null,available:true,condition:'new',matched_product_id:MBA,match_confidence:1,collection_status:'success'} as any);
  const [ct,st]=InMemoryTransport.createLinkedPair();await createMcpServer(db).connect(st);const client=new Client({name:'contract',version:'1'});await client.connect(ct);return client};
const reject=async(client:Client,name:string,args:any,field:string)=>{let message='';try{const r:any=await client.callTool({name,arguments:args});if(!r.isError)throw new Error('accepted invalid input');message=String(r.content?.[0]?.text)}catch(e:any){message=String(e.message)}expect(message).toContain('Invalid arguments');expect(message).toContain(field)};

describe('MCP tool input contract (guards zod major upgrades)',()=>{
  it('advertises the nine tools with typed, bounded, defaulted inputs',async()=>{const c=await connect();const tools=Object.fromEntries((await c.listTools()).tools.map(t=>[t.name,t.inputSchema as any]));
    expect(Object.keys(tools).sort()).toEqual(['compare_prices','find_best_offer','get_price','get_price_history','list_catalog','list_decisions','record_decision','search_price','search_products']);
    expect(tools.compare_prices.required).toEqual(['product_id']);expect(tools.compare_prices.properties).toMatchObject({trusted_only:{type:'boolean',default:false},include_membership:{type:'boolean',default:false},max_age_hours:{type:'number',default:6,exclusiveMinimum:0}});
    expect(tools.find_best_offer.properties.trusted_only).toMatchObject({type:'boolean',default:true});
    expect(tools.get_price_history.properties.days).toMatchObject({type:'integer',default:30,minimum:1,maximum:365});
    expect(tools.list_decisions.properties.limit).toMatchObject({type:'integer',default:20,minimum:1,maximum:100});
    expect(tools.record_decision.properties.rationale).toMatchObject({type:'string',minLength:10,maxLength:1000});
    expect(tools.search_price.properties.type.enum).toEqual(['product','flight']);expect(tools.search_price.properties.cabin.enum).toEqual(['economy','premium_economy','business','first']);expect(tools.search_price.properties.adults).toMatchObject({minimum:1,maximum:9})});
  it('applies defaults when optional arguments are omitted',async()=>{const c=await connect();const r:any=await c.callTool({name:'compare_prices',arguments:{product_id:MBA}});const body=JSON.parse(r.content[0].text);expect(body).toMatchObject({trusted_only:false,include_membership:false,max_age_hours:6});expect(body.offers.length).toBeGreaterThan(0)});
  it('rejects out-of-range and mistyped arguments with the offending field named',async()=>{const c=await connect();
    await reject(c,'compare_prices',{product_id:MBA,max_age_hours:0},'max_age_hours');await reject(c,'compare_prices',{product_id:MBA,trusted_only:'yes'},'trusted_only');
    await reject(c,'get_price_history',{product_id:MBA,days:0},'days');await reject(c,'get_price_history',{product_id:MBA,days:1.5},'days');await reject(c,'get_price_history',{product_id:MBA,days:366},'days');
    await reject(c,'list_decisions',{limit:500},'limit');await reject(c,'record_decision',{product_id:MBA,merchant_id:'apple',rationale:'short'},'rationale');
    await reject(c,'get_price',{},'product_id');await reject(c,'get_price',{product_id:42},'product_id');await reject(c,'search_products',{query:''},'query')});
  it('ignores unknown extra arguments as before the upgrade',async()=>{const c=await connect();const r:any=await c.callTool({name:'get_price',arguments:{product_id:MBA,bogus:1}});expect(r.isError).toBeFalsy();expect(JSON.parse(r.content[0].text).product.product_id).toBe(MBA)});
});
