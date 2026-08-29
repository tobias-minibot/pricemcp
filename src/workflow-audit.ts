import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint=new URL(process.env.PRICEMCP_MCP_URL||'http://127.0.0.1:3199/mcp');
const client=new Client({name:'pricemcp-workflow-audit',version:'0.1.0'});
await client.connect(new StreamableHTTPClientTransport(endpoint));

const scenarios=[
  {name:'best-current-laptop',tool:'find_best_offer',arguments:{query:'MacBook Air M5 13-inch 16GB 512GB',trusted_only:true,max_age_hours:6}},
  {name:'compare-trusted-sellers',tool:'compare_prices',arguments:{product_id:'apple-macbook-pro-m5-pro-14-24-1024',trusted_only:true}},
  {name:'mac-mini-generation',tool:'find_best_offer',arguments:{query:'Mac mini M6 16GB 256GB',trusted_only:true,max_age_hours:6}},
  {name:'unresolved-query',tool:'search_products',arguments:{query:'NVIDIA RTX 5090 Founders Edition'}},
  {name:'price-history',tool:'get_price_history',arguments:{product_id:'apple-macbook-air-m5-13-16-512',days:30}}
] as const;

const results=[];
for(const scenario of scenarios){
  const response=await client.callTool({name:scenario.tool,arguments:scenario.arguments});
  const data=response.structuredContent as any;
  const summary=scenario.name==='best-current-laptop'||scenario.name==='mac-mini-generation'
    ?{resolved_product_id:data?.resolved_product?.product_id??null,best_merchant:data?.best_offer?.merchant?.merchant_id??null,best_amount_minor:data?.best_offer?.quote?.effective_amount_minor??null,freshness:data?.best_offer?.freshness_status??null,shipping_basis:data?.best_offer?.quote?.shipping_basis??null}
    :scenario.name==='compare-trusted-sellers'
      ?{product_id:data?.product?.product_id??null,offer_count:data?.offers?.length??0,merchants:(data?.offers||[]).map((x:any)=>x.merchant.merchant_id),amounts_minor:(data?.offers||[]).map((x:any)=>x.quote.effective_amount_minor)}
      :scenario.name==='unresolved-query'
        ?{result_count:data?.results?.length??0,correctly_unresolved:(data?.results?.length??0)===0}
        :{product_id:data?.product_id??null,points:data?.points?.length??0,change_minor:data?.change_minor??null,low_30d_minor:data?.low_30d_minor??null,high_30d_minor:data?.high_30d_minor??null};
  results.push({name:scenario.name,tool:scenario.tool,ok:!data?.error,summary});
}
await client.close();
console.log(JSON.stringify({endpoint:endpoint.toString(),run_at:new Date().toISOString(),results},null,2));
