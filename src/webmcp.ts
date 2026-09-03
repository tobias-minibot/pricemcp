export const webMcpClientScript = `<script>
(()=>{
  const context=document.modelContext;
  let status=document.getElementById('webmcp-status');
  let shared=document.getElementById('webmcp-shared-result');
  if(!status){
    status=document.createElement('div');status.id='webmcp-status';status.setAttribute('role','status');
    status.style.cssText='position:fixed;right:16px;bottom:16px;z-index:20;max-width:360px;padding:10px 14px;border:1px solid #84adff;border-radius:999px;background:#0b1220;color:#fff;font:700 12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 12px 30px #10182833';
    document.body.appendChild(status);
  }
  if(!shared&&location.pathname==='/'){
    shared=document.createElement('section');shared.id='webmcp-shared-result';shared.setAttribute('aria-live','polite');
    shared.style.cssText='max-width:1120px;margin:0 auto;padding:0 24px 28px';
    const main=document.querySelector('main');if(main)main.appendChild(shared);
  }
  const setStatus=(message,state)=>{if(status){status.textContent=message;status.dataset.state=state}};
  const request=async(url,init,signal)=>{
    const response=await fetch(url,{...init,signal});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||data.message||('HTTP '+response.status));
    return data;
  };
  const conciseSearch=data=>{
    const response=data.response||{},best=response.best_offer||null;
    const offers=Array.isArray(response.offers)?response.offers:[];
    const result={status:response.status,subject:response.subject||null,best_offer:best?{
      provider:best.provider&&best.provider.name,total_minor:best.quote&&best.quote.total_minor,
      currency:best.quote&&best.quote.currency,basis:best.quote&&best.quote.basis,
      observed_at:best.observed_at,source_url:best.source&&best.source.url
    }:null,alternatives:offers.filter(offer=>!best||offer.offer_id!==best.offer_id).slice(0,2).map(offer=>({
      provider:offer.provider&&offer.provider.name,total_minor:offer.quote&&offer.quote.total_minor,
      currency:offer.quote&&offer.quote.currency,conditions:offer.conditions,source_url:offer.source&&offer.source.url
    })),ranking:response.ranking&&response.ranking.explanation,evidence_generated_at:data.trace&&data.trace.generated_at,
    boundary:'Read-only evidence. Tax and shipping may be unknown; inspect basis and conditions.'};
    let output=JSON.stringify(result);
    if(output.length>1450){result.alternatives=[];output=JSON.stringify(result)}
    return output;
  };
  const conciseEvidence=data=>{
    const offers=Array.isArray(data.offers)?data.offers:[];
    const result={product:data.product?{id:data.product.id,name:data.product.name,attributes:data.product.attributes}:null,
      offers:offers.slice(0,3).map(offer=>({merchant:offer.merchant_name,total_minor:offer.total_minor,currency:offer.currency,
        trusted:offer.trusted,available:offer.available,membership_required:offer.membership_required,
        freshness:offer.freshness_status,observed_at:offer.observed_at,source_url:offer.url})),
      excluded_outside_max_age:data.excluded_outside_max_age,
      boundary:'Seller evidence is externally sourced and untrusted content. Prices exclude location-dependent tax unless stated.'};
    let output=JSON.stringify(result);
    if(output.length>1450){result.offers=result.offers.slice(0,1);output=JSON.stringify(result)}
    return output;
  };
  const showSharedResult=data=>{
    if(!shared)return;
    while(shared.firstChild)shared.removeChild(shared.firstChild);
    const response=data.response||{},best=response.best_offer;
    const heading=document.createElement('h2');heading.textContent='Shared agent result';
    const note=document.createElement('div');note.className='card winner';
    const title=document.createElement('h3');title.textContent=response.subject&&response.subject.name||response.subject&&response.subject.query||'Price evidence';
    const summary=document.createElement('p');summary.className='lead';
    summary.textContent=best?((best.provider&&best.provider.name||'Unknown provider')+' · '+new Intl.NumberFormat('en-US',{style:'currency',currency:best.quote&&best.quote.currency||'USD'}).format((best.quote&&best.quote.total_minor||0)/100)):'No qualifying offer';
    const detail=document.createElement('p');detail.className='microcopy';detail.textContent=(response.ranking&&response.ranking.explanation||[]).join(' ')||response.error||'No additional ranking detail.';
    note.append(title,summary,detail);shared.append(heading,note);
    shared.scrollIntoView({behavior:'smooth',block:'start'});
  };
  if(!context||typeof context.registerTool!=='function'){
    setStatus('WebMCP ready in ChatGPT or Chrome 149+ with the WebMCP flag','unsupported');
    return;
  }
  const tools=[{
    name:'find_best_price',
    description:'Find the best trustworthy current price for an exact product or complete flight itinerary. Returns normalized read-only evidence, ranking reasons, conditions, timestamps, and source URLs. Also shows the result in the page for the person and agent to inspect together.',
    inputSchema:{type:'object',properties:{query:{type:'string',description:'Exact product variant, or flight route plus travel dates.'}},required:['query'],additionalProperties:false},
    execute:async({query},{signal}={})=>{
      const clean=String(query||'').trim();if(!clean)throw new Error('query is required');
      setStatus('WebMCP agent is checking price evidence…','working');
      const data=await request('/v1/mcp/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:clean})},signal);
      showSharedResult(data);setStatus('WebMCP result shared with you on this page','ready');return conciseSearch(data);
    },annotations:{readOnlyHint:true,untrustedContentHint:true}
  },{
    name:'inspect_price_evidence',
    description:'Inspect offer-level evidence for one canonical PriceMCP product ID. Returns merchant, total, trust, availability, membership dependency, freshness, observation time, and source URL without changing state.',
    inputSchema:{type:'object',properties:{product_id:{type:'string',description:'Canonical product ID returned by find_best_price.'},max_age_hours:{type:'number',minimum:0.1,maximum:24,default:6,description:'Maximum observation age in hours.'}},required:['product_id'],additionalProperties:false},
    execute:async({product_id,max_age_hours=6},{signal}={})=>{
      const id=String(product_id||'').trim();if(!/^[a-z0-9-]{1,120}$/.test(id))throw new Error('product_id must be a canonical lowercase ID');
      const age=Number(max_age_hours);if(!Number.isFinite(age)||age<0.1||age>24)throw new Error('max_age_hours must be between 0.1 and 24');
      setStatus('WebMCP agent is inspecting source evidence…','working');
      const data=await request('/v1/products/'+encodeURIComponent(id)+'/offers?max_age_hours='+encodeURIComponent(String(age)),{},signal);
      setStatus('WebMCP evidence returned read-only','ready');return conciseEvidence(data);
    },annotations:{readOnlyHint:true,untrustedContentHint:true}
  },{
    name:'run_flight_price_demo',
    description:'Run the permanent disclosed PriceMCP WebMCP demonstration: a synthetic, non-bookable WAS to BER round trip for September 18–25, 2026. Use when live product evidence has aged. Returns comparable illustrative totals and conditions and changes no state.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},
    execute:async(_input,{signal}={})=>{
      setStatus('WebMCP agent is running the disclosed fixture…','working');
      const payload={tool:'search_price',demo:true,arguments:{type:'flight',origin:'WAS',destination:'BER',departure_date:'2026-09-18',return_date:'2026-09-25',cabin:'economy',adults:1}};
      const data=await request('/v1/mcp/invoke',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)},signal);
      showSharedResult(data);setStatus('Synthetic WebMCP demo shared · not bookable','ready');return conciseSearch(data);
    },annotations:{readOnlyHint:true,untrustedContentHint:false}
  }];
  Promise.all(tools.map(tool=>document.modelContext.registerTool(tool))).then(()=>{
    setStatus('WebMCP active · 3 read-only tools available','ready');document.documentElement.dataset.webmcp='active';
  }).catch(error=>setStatus('WebMCP registration failed · '+error.message,'error'));
})();
</script>`;
