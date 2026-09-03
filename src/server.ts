import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Cron } from 'croner';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { openDatabase, seed, searchProducts, getProduct, getOffers, bestPrice, history, health, recordCollection, listFeaturedProducts } from './db.js';
import { createMcpServer } from './mcp.js';
import { companionPage, developerPage, homePage, productPage, statusPage } from './web.js';
import { runCollectors, runPriorityCollectors } from './collectors.js';
import { evaluateCollectionHealth, notifyCollectionIssues } from './monitor.js';
import { isIsoDate, parseNaturalPriceQuery, searchPrice } from './price-search.js';
import { catalogSummary } from './subject-catalog.js';

async function withDiagnosticMcp<T>(db:ReturnType<typeof openDatabase>,options:{allowDemoFlights:boolean;forceDemoFlights?:boolean},run:(client:Client)=>Promise<T>):Promise<T>{
  const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
  const server=createMcpServer(db,{allowWrites:false,...options});
  const client=new Client({name:'pricemcp-infrastructure-console',version:'0.1.0'});
  try{
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return await run(client);
  }finally{
    await client.close().catch(()=>undefined);
    await server.close().catch(()=>undefined);
  }
}

function diagnosticTrace(data:any,durationMs:number){
  const offers=Array.isArray(data?.offers)?data.offers:[];
  const providers=[...new Set(offers.map((offer:any)=>offer?.provider?.name).filter(Boolean))];
  const provenanceCount=offers.filter((offer:any)=>offer?.source?.url).length;
  const ages=offers.map((offer:any)=>offer?.freshness?.age_seconds).filter((value:any)=>Number.isFinite(value));
  return{
    transport:'Model Context Protocol via the official TypeScript SDK',
    endpoint:'/mcp',
    duration_ms:durationMs,
    canonical_identity:data?.subject?.product_id??(data?.subject?.type==='flight'?`${data.subject.origin}-${data.subject.destination}`:null),
    entity_type:data?.subject?.type??null,
    normalized_offer_count:offers.length,
    provider_count:providers.length,
    providers,
    provenance_urls:provenanceCount,
    freshest_age_seconds:ages.length?Math.min(...ages):null,
    validation:data?.subject?.type==='product'?['unique canonical entity','exact variant','trusted seller','availability','freshness']:['complete itinerary','provider configured or explicit synthetic fixture','comparable total','conditions preserved'],
    ranking_policy:data?.ranking?.policy??null,
    generated_at:new Date().toISOString()
  };
}

export function buildApp(db=openDatabase(),options:{readOnly?:boolean}={}){
  const isDemo=process.env.PRICEMCP_DATASET==='pricemcp-demo-v1';if(!isDemo&&!options.readOnly)seed(db);const app=Fastify({logger:true});
  const apiToken=process.env.PRICEMCP_API_TOKEN;
  if(apiToken)app.addHook('onRequest',async(req,reply)=>{
    const publicReadOnlyDiagnostic=options.readOnly&&(req.url==='/developer'||req.url.startsWith('/v1/mcp/'));
    if(req.url.startsWith('/internal/health')||publicReadOnlyDiagnostic)return;
    const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    const valid=supplied.length===apiToken.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(apiToken));
    if(!valid)return reply.code(401).send({error:'unauthorized'});
  });
  const requestedMaxAgeHours=(query:any):number|undefined=>{const value=query.max_age!==undefined?Number(query.max_age)/3600:query.max_age_hours!==undefined?Number(query.max_age_hours):undefined;if(value!==undefined&&(!Number.isFinite(value)||value<0))throw Object.assign(new Error('max_age must be a finite nonnegative number'),{statusCode:400});return value};
  app.setErrorHandler((error,_req,reply)=>reply.code((error as any).statusCode||500).send({error:'request_failed',message:(error as Error).message}));
  app.get('/',async(req,reply)=>{const q=String((req.query as any).q||'');const subject=q?parseNaturalPriceQuery(q):null;const result=subject?await searchPrice(db,subject,{allowDemoFlights:isDemo}):null;const products=subject?.type==='product'?searchProducts(db,subject.query):isDemo&&!q?listFeaturedProducts(db):[];reply.type('text/html').send(homePage(products,q,result))});
  app.get('/companion',(_req,reply)=>reply.type('text/html').send(companionPage({flightProviderConfigured:Boolean(process.env.DUFFEL_ACCESS_TOKEN||process.env.AMADEUS_API_KEY&&process.env.AMADEUS_API_SECRET)})));
  app.get('/developer',(_req,reply)=>reply.type('text/html').send(developerPage()));
  app.get('/products/:id',(req,reply)=>{const id=(req.params as any).id,p=getProduct(db,id);if(!p)return reply.code(404).type('text/html').send(homePage([],id));reply.type('text/html').send(productPage(p,getOffers(db,id),bestPrice(db,id),history(db,id)))});
  app.get('/status',(_req,reply)=>reply.type('text/html').send(statusPage(health(db))));
  app.get('/internal/health',()=>health(db));
  app.get('/v1/hackathon-partners',()=>({
    status:'verified_submission_evidence',
    generated_at:new Date().toISOString(),
    partners:[
      {name:'Bright Data',role:'Retailer evidence access',state:'verified',facts:['4 exact AirPods Pro 3 retailer PDPs collected','Walmart, Target, B&H, and Adorama','saved extraction and repair rules'],evidence:'/developer'},
      {name:'TrueForge',role:'Agent runtime and approval boundary',state:'verified',facts:['PriceMCP called through MCP','Python executed in an isolated sandbox','durable action paused for human approval'],evidence:'/docs/SUBMISSION.md'},
      {name:'Qodo',role:'Independent code review',state:'verified',facts:['public review completed','2 substantive findings fixed','submission path reverified after fixes'],evidence:'https://github.com/tobias-minibot/pricemcp/pull/2#issuecomment-5464186759'}
    ],
    boundary:'This endpoint reports recorded submission evidence. It does not claim that every partner is a price-data source or that retailer pages are fetched on each request.'
  }));
  app.get('/v1/catalog',()=>catalogSummary());
  app.get('/v1/mcp/tools',async()=>{
    const started=performance.now();
    return withDiagnosticMcp(db,{allowDemoFlights:isDemo},async client=>{
      const result=await client.listTools();
      return{protocol:'MCP',server:'PriceMCP',endpoint:'/mcp',transport:'Streamable HTTP in production; official SDK loopback for this introspection response',read_only:true,duration_ms:Number((performance.now()-started).toFixed(2)),tools:result.tools};
    });
  });
  const invokeDiagnostic=async(args:Record<string,unknown>,demoFlight=false)=>{
    const started=performance.now();
    return withDiagnosticMcp(db,{allowDemoFlights:isDemo||demoFlight,forceDemoFlights:demoFlight},async client=>{
      const result=await client.callTool({name:'search_price',arguments:args});
      const durationMs=Number((performance.now()-started).toFixed(2));
      const structured=(result as any).structuredContent??null;
      return{protocol:'MCP',server:'PriceMCP',tool:'search_price',endpoint:'/mcp',execution:'official MCP SDK client → PriceMCP MCP server',mode:demoFlight?'synthetic_flight_fixture':isDemo?'synthetic_demo':'live_snapshot',request:args,response:structured,trace:diagnosticTrace(structured,durationMs)};
    });
  };
  app.post('/v1/mcp/invoke',async(req,reply)=>{
    const body=(req.body||{}) as any;
    if(body.tool!=='search_price')return reply.code(400).send({status:'invalid_request',error:'The public diagnostic bridge only permits the read-only search_price tool.'});
    if(!body.arguments||typeof body.arguments!=='object'||Array.isArray(body.arguments))return reply.code(400).send({status:'invalid_request',error:'arguments must be an object'});
    const demoFlight=body.demo===true;
    if(demoFlight&&body.arguments.type!=='flight')return reply.code(400).send({status:'invalid_request',error:'demo mode is restricted to the explicitly labeled flight fixture'});
    return invokeDiagnostic(body.arguments,demoFlight);
  });
  app.post('/v1/mcp/search',async(req,reply)=>{
    const query=String(((req.body||{}) as any).query||'').trim();
    if(!query)return reply.code(400).send({status:'invalid_request',error:'query is required'});
    const subject=parseNaturalPriceQuery(query);
    if(subject.type==='incomplete')return reply.code(400).send({status:'invalid_request',error:`Missing ${subject.missing.join(' and ')}`,subject});
    return invokeDiagnostic(subject,isDemo&&subject.type==='flight');
  });
  app.get('/v1/search',(req)=>{const q=String((req.query as any).q||'');return{dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,query:q,results:searchProducts(db,q),observed_scope:'US',currency:'USD'}});
  app.get('/v1/products/:id',(req,reply)=>{const p=getProduct(db,(req.params as any).id);return p||reply.code(404).send({error:'not_found'})});
  app.get('/v1/products/:id/offers',(req)=>{const id=(req.params as any).id,max=requestedMaxAgeHours(req.query);const all=getOffers(db,id),offers=max===undefined?all:getOffers(db,id,max);return{dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,product:getProduct(db,id),offers,max_age_seconds:max===undefined?null:max*3600,excluded_outside_max_age:all.length-offers.length}});
  app.get('/v1/products/:id/history',(req)=>history(db,(req.params as any).id,Number((req.query as any).days||30)));
  app.get('/v1/compare',(req)=>{const ids=String((req.query as any).ids||'').split(',').filter(Boolean);return{products:ids.map(id=>({product:getProduct(db,id),price:bestPrice(db,id)}))}});
  app.get('/v1/best-price/:id',(req)=>bestPrice(db,(req.params as any).id,requestedMaxAgeHours(req.query)));
  app.post('/v1/search-price',async(req,reply)=>{const input=(req.body||{}) as any;if(input.type!=='product'&&input.type!=='flight')return reply.code(400).send({status:'invalid_request',error:'type must be product or flight'});if(input.type==='product'){if(typeof input.query!=='string'||!input.query.trim())return reply.code(400).send({status:'invalid_request',error:'product query is required'});return searchPrice(db,{type:'product',query:input.query.trim()},{maxAgeHours:requestedMaxAgeHours(req.query)});}const required=['origin','destination','departure_date'] as const;if(required.some(field=>typeof input[field]!=='string'||!input[field].trim()))return reply.code(400).send({status:'invalid_request',error:'origin, destination, and departure_date are required'});if(!isIsoDate(input.departure_date)||input.return_date&&!isIsoDate(input.return_date))return reply.code(400).send({status:'invalid_request',error:'flight dates must be valid YYYY-MM-DD values'});const cabins=['economy','premium_economy','business','first'] as const;if(input.cabin!==undefined&&!cabins.includes(input.cabin))return reply.code(400).send({status:'invalid_request',error:'unsupported cabin'});const cabin=input.cabin||'economy',adults=Number(input.adults||1);if(!Number.isInteger(adults)||adults<1||adults>9)return reply.code(400).send({status:'invalid_request',error:'adults must be an integer from 1 to 9'});return searchPrice(db,{type:'flight',origin:input.origin,destination:input.destination,departure_date:input.departure_date,...(input.return_date?{return_date:input.return_date}:{}),cabin,adults},{allowDemoFlights:isDemo});});
  const notImplemented=(category:string)=>({status:'not_implemented',category,dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,schema:{subject:{type:category},quote:{amount_minor:null,currency:null},provider:null,conditions:[],observed_at:null,expires_at:null},data:null});
  app.get('/v1/fx',()=>notImplemented('fx'));app.get('/v1/flights',async(req)=>{const query=req.query as any;if(!query.origin||!query.destination||!query.departure_date)return notImplemented('flight');return searchPrice(db,{type:'flight',origin:String(query.origin),destination:String(query.destination),departure_date:String(query.departure_date),return_date:query.return_date?String(query.return_date):undefined,cabin:query.cabin||'economy',adults:Number(query.adults||1)},{allowDemoFlights:isDemo});});
  app.all('/mcp',async(req,reply)=>{const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});reply.raw.on('close',()=>transport.close());await createMcpServer(db,{allowWrites:!options.readOnly,allowDemoFlights:isDemo}).connect(transport);await transport.handleRequest(req.raw,reply.raw,(req as any).body);reply.hijack()});
  return app;
}

if(process.env.NODE_ENV!=='test'&&import.meta.url===`file://${process.argv[1]}`){
  const db=openDatabase();if(process.env.PRICEMCP_DATASET!=='pricemcp-demo-v1')seed(db);const app=buildApp(db);
  if(process.env.PRICEMCP_SCHEDULER!=='false'){
    const recordAndMonitor=async(results:Awaited<ReturnType<typeof runCollectors>>)=>{for(const r of results)recordCollection(db,r);await notifyCollectionIssues(evaluateCollectionHealth(health(db)))};
    new Cron('*/45 * * * *',async()=>recordAndMonitor(await runPriorityCollectors()));
    new Cron('23 */4 * * *',async()=>recordAndMonitor(await runCollectors()));
    new Cron('17 3 * * *',()=>seed(db));
  }
  if(process.env.PRICEMCP_COLLECT_ON_START==='true')for(const r of await runCollectors())recordCollection(db,r);
  await app.listen({port:Number(process.env.PORT||3199),host:process.env.HOST||'127.0.0.1'});
}
