import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const endpoint=new URL(process.env.PRICEMCP_MCP_URL||'http://127.0.0.1:3199/mcp');
const client=new Client({name:'pricemcp-workflow-audit',version:'0.1.0'});
await client.connect(new StreamableHTTPClientTransport(endpoint));

const results=[];
const call=async(name:string,tool:string,args:Record<string,unknown>)=>{
  const response=await client.callTool({name:tool,arguments:args});
  const data=response.structuredContent as any;
  const toolError=response.isError===true;
  const summary=name==='best-current-laptop'||name==='mac-mini-generation'
    ?{resolved_product_id:data?.resolved_product?.product_id??null,resolved_family:data?.resolved_product?.family??null,resolved_attributes:data?.resolved_product?.attributes??null,best_merchant:data?.best_offer?.merchant?.merchant_id??null,best_amount_minor:data?.best_offer?.quote?.effective_amount_minor??null,freshness:data?.best_offer?.freshness_status??null,shipping_basis:data?.best_offer?.quote?.shipping_basis??null}
    :name==='compare-trusted-sellers'
      ?{product_id:data?.product?.product_id??null,offer_count:data?.offers?.length??0,merchants:(data?.offers||[]).map((x:any)=>x.merchant.merchant_id),amounts_minor:(data?.offers||[]).map((x:any)=>x.quote.effective_amount_minor)}
      :name==='unresolved-query'
        ?{result_count:data?.results?.length??0,correctly_unresolved:(data?.results?.length??0)===0}
        :{product_id:data?.product_id??null,points:data?.points?.length??0,change_minor:data?.change_minor??null,low_30d_minor:data?.low_30d_minor??null,high_30d_minor:data?.high_30d_minor??null};
  const exactProduct=name==='mac-mini-generation'
    ?summary.resolved_family==='Mac mini'&&summary.resolved_attributes?.chip==='M6'&&summary.resolved_attributes?.memory_gb===16&&summary.resolved_attributes?.storage_gb===256
    :name==='best-current-laptop'
      ?summary.resolved_family==='MacBook Air'&&summary.resolved_attributes?.chip==='M5'&&summary.resolved_attributes?.memory_gb===16&&summary.resolved_attributes?.storage_gb===512
      :true;
  const ok=!toolError&&!data?.error&&(
    name==='best-current-laptop'||name==='mac-mini-generation'?exactProduct&&!!summary.best_merchant:
    name==='compare-trusted-sellers'?!!summary.product_id&&summary.offer_count>0:
    name==='unresolved-query'?summary.correctly_unresolved:
    !!summary.product_id&&summary.points>0
  );
  results.push({name,tool,ok,summary});
  return data;
};

const laptop=await call('best-current-laptop','find_best_offer',{query:'MacBook Air M5 13-inch 16GB 512GB',trusted_only:true,max_age_hours:6});
const laptopId=laptop?.resolved_product?.product_id;
if(laptopId){
  await call('compare-trusted-sellers','compare_prices',{product_id:laptopId,trusted_only:true});
}else{
  results.push({name:'compare-trusted-sellers',tool:'compare_prices',ok:false,summary:{error:'laptop_resolution_failed'}});
}
await call('mac-mini-generation','find_best_offer',{query:'Mac mini M6 16GB 256GB',trusted_only:true,max_age_hours:6});
await call('unresolved-query','search_products',{query:'NVIDIA RTX 5090 Founders Edition'});
if(laptopId){
  await call('price-history','get_price_history',{product_id:laptopId,days:30});
}else{
  results.push({name:'price-history',tool:'get_price_history',ok:false,summary:{error:'laptop_resolution_failed'}});
}
await client.close();
console.log(JSON.stringify({endpoint:endpoint.toString(),run_at:new Date().toISOString(),ok:results.every(result=>result.ok),results},null,2));
if(results.some(result=>!result.ok))process.exitCode=1;
