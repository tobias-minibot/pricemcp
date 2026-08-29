import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Db } from './db.js';
import { bestPrice, getOffers, getProduct, history, listDecisions, recordDecision, searchProducts } from './db.js';

const response=(data:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(data)}],structuredContent:data as Record<string,unknown>});
const productView=(p:any)=>p?({product_id:p.id,brand:p.brand,category:p.category,family:p.family,name:p.name,model:p.model??null,attributes:p.attributes,active:p.active,official_url:p.official_url,dataset:p.dataset??'live',synthetic:!!p.synthetic,...(p.score===undefined?{}:{match_score:p.score})}):null;
const offerView=(o:any)=>o?({product_id:o.product_id,dataset:o.dataset??'live',synthetic:!!o.synthetic,merchant:{merchant_id:o.merchant_id,name:o.merchant_name,verified:o.verified,authorized:o.authorized,trust_score:o.trust_score,marketplace_seller:o.marketplace_seller},quote:{amount_minor:o.price_minor,shipping_minor:o.shipping_minor,effective_amount_minor:o.total_minor,currency:o.currency,shipping_basis:o.shipping_minor===null?'unknown':'observed'},availability:o.available?'in_stock':'unavailable',condition:o.condition,membership_required:o.membership_required,trusted:o.trusted,source:{method:o.source_method,source_product_id:o.source_product_id,url:o.url},observed_at:o.observed_at,age_seconds:o.age_seconds,freshness_status:o.freshness_status}):null;
const summaryView=(data:any)=>({product_id:data.product_id,cheapest_offer:offerView(data.cheapest_offer),best_trusted_offer:offerView(data.best_trusted_offer),best_membership_offer:offerView(data.best_membership_offer),official_price:offerView(data.official_price),savings_vs_official_minor:data.savings_vs_official_minor,evidence_count:data.evidence_count,max_age_hours:data.max_age_hours});
const historyPointView=(p:any)=>p?({dataset:p.dataset??'live',synthetic:!!p.synthetic,merchant_id:p.merchant_id,merchant_name:p.merchant_name,amount_minor:p.price_minor,effective_amount_minor:p.normalized_total_minor,currency:p.currency,availability:p.available?'in_stock':'unavailable',condition:p.condition,source:{method:p.source_method,source_product_id:p.source_product_id,url:p.url},observed_at:p.observed_at}):null;
const historyView=(data:any)=>({product_id:data.product_id,days:data.days,current:historyPointView(data.current),previous:historyPointView(data.previous),change_minor:data.change_minor,change_percent:data.change_percent,low_30d_minor:data.low_30d_minor,high_30d_minor:data.high_30d_minor,points:data.points.map(historyPointView)});

export function createMcpServer(db:Db):McpServer{
  const server=new McpServer({name:'PriceMCP',version:'0.1.0'});
  server.registerTool('search_products',{description:'Resolve a product query to canonical, category-generic PriceMCP product IDs.',inputSchema:{query:z.string().min(1)}},async({query})=>response({query,results:searchProducts(db,query).map(productView)}));
  server.registerTool('get_price',{description:'Get cheapest, best trusted, and official current price with freshness evidence.',inputSchema:{product_id:z.string()}},async({product_id})=>{
    const product=getProduct(db,product_id);return response(product?{product:productView(product),...summaryView(bestPrice(db,product_id))}:{error:'not_found',product_id});
  });
  server.registerTool('compare_prices',{description:'Compare normalized current offers for a canonical product.',inputSchema:{product_id:z.string(),trusted_only:z.boolean().default(false)}},async({product_id,trusted_only})=>{
    let offers=getOffers(db,product_id);if(trusted_only)offers=offers.filter(o=>o.trusted);return response({product:productView(getProduct(db,product_id)),trusted_only,offers:offers.map(offerView)});
  });
  server.registerTool('find_best_offer',{description:'Resolve a query and rank current offers, respecting trust, membership conditions, and maximum age.',inputSchema:{query:z.string().min(1),trusted_only:z.boolean().default(true),include_membership:z.boolean().default(false),max_age_hours:z.number().positive().default(6)}},async({query,trusted_only,include_membership,max_age_hours})=>{
    const product=searchProducts(db,query,1)[0];if(!product)return response({query,error:'no_product_match'});
    const offers=getOffers(db,product.id,max_age_hours).filter(o=>o.available&&(!trusted_only||o.trusted)&&(include_membership||!o.membership_required));
    return response({query,resolved_product:productView(product),best_offer:offerView(offers[0]),offers:offers.map(offerView),max_age_hours,trusted_only,include_membership});
  });
  server.registerTool('get_price_history',{description:'Return append-first observations and range/change metrics.',inputSchema:{product_id:z.string(),days:z.number().int().min(1).max(365).default(30)}},async({product_id,days})=>response(historyView(history(db,product_id,days))));
  server.registerTool('list_decisions',{description:'List recent append-only procurement decision records.',inputSchema:{limit:z.number().int().min(1).max(100).default(20)},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async({limit})=>response({decisions:listDecisions(db,limit)}));
  server.registerTool('record_decision',{description:'Append a final procurement decision tied to a fresh PriceMCP offer. This changes durable state and must be human-approved before execution.',inputSchema:{product_id:z.string(),merchant_id:z.string(),rationale:z.string().min(10).max(1000)},annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false}},async({product_id,merchant_id,rationale})=>response({status:'recorded',decision:recordDecision(db,product_id,merchant_id,rationale)}));
  return server;
}
