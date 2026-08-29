import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Cron } from 'croner';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { openDatabase, seed, searchProducts, getProduct, getOffers, bestPrice, history, health, recordCollection, listFeaturedProducts } from './db.js';
import { createMcpServer } from './mcp.js';
import { homePage, productPage, statusPage } from './web.js';
import { runCollectors, runPriorityCollectors } from './collectors.js';
import { evaluateCollectionHealth, notifyCollectionIssues } from './monitor.js';
import { isIsoDate, parseNaturalPriceQuery, searchPrice } from './price-search.js';

export function buildApp(db=openDatabase()){
  const isDemo=process.env.PRICEMCP_DATASET==='pricemcp-demo-v1';if(!isDemo)seed(db);const app=Fastify({logger:true});
  const apiToken=process.env.PRICEMCP_API_TOKEN;
  if(apiToken)app.addHook('onRequest',async(req,reply)=>{
    if(req.url.startsWith('/internal/health'))return;
    const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    const valid=supplied.length===apiToken.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(apiToken));
    if(!valid)return reply.code(401).send({error:'unauthorized'});
  });
  const requestedMaxAgeHours=(query:any):number|undefined=>{const value=query.max_age!==undefined?Number(query.max_age)/3600:query.max_age_hours!==undefined?Number(query.max_age_hours):undefined;if(value!==undefined&&(!Number.isFinite(value)||value<0))throw Object.assign(new Error('max_age must be a finite nonnegative number'),{statusCode:400});return value};
  app.setErrorHandler((error,_req,reply)=>reply.code((error as any).statusCode||500).send({error:'request_failed',message:(error as Error).message}));
  app.get('/',async(req,reply)=>{const q=String((req.query as any).q||'');const subject=q?parseNaturalPriceQuery(q):null;const result=subject?await searchPrice(db,subject,{allowDemoFlights:isDemo}):null;const products=subject?.type==='product'?searchProducts(db,subject.query):isDemo&&!q?listFeaturedProducts(db):[];reply.type('text/html').send(homePage(products,q,result))});
  app.get('/products/:id',(req,reply)=>{const id=(req.params as any).id,p=getProduct(db,id);if(!p)return reply.code(404).type('text/html').send(homePage([],id));reply.type('text/html').send(productPage(p,getOffers(db,id),bestPrice(db,id),history(db,id)))});
  app.get('/status',(_req,reply)=>reply.type('text/html').send(statusPage(health(db))));
  app.get('/internal/health',()=>health(db));
  app.get('/v1/search',(req)=>{const q=String((req.query as any).q||'');return{dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,query:q,results:searchProducts(db,q),observed_scope:'US',currency:'USD'}});
  app.get('/v1/products/:id',(req,reply)=>{const p=getProduct(db,(req.params as any).id);return p||reply.code(404).send({error:'not_found'})});
  app.get('/v1/products/:id/offers',(req)=>{const id=(req.params as any).id,max=requestedMaxAgeHours(req.query);const all=getOffers(db,id),offers=max===undefined?all:getOffers(db,id,max);return{dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,product:getProduct(db,id),offers,max_age_seconds:max===undefined?null:max*3600,excluded_outside_max_age:all.length-offers.length}});
  app.get('/v1/products/:id/history',(req)=>history(db,(req.params as any).id,Number((req.query as any).days||30)));
  app.get('/v1/compare',(req)=>{const ids=String((req.query as any).ids||'').split(',').filter(Boolean);return{products:ids.map(id=>({product:getProduct(db,id),price:bestPrice(db,id)}))}});
  app.get('/v1/best-price/:id',(req)=>bestPrice(db,(req.params as any).id,requestedMaxAgeHours(req.query)));
  app.post('/v1/search-price',async(req,reply)=>{const input=(req.body||{}) as any;if(input.type!=='product'&&input.type!=='flight')return reply.code(400).send({status:'invalid_request',error:'type must be product or flight'});if(input.type==='product'){if(typeof input.query!=='string'||!input.query.trim())return reply.code(400).send({status:'invalid_request',error:'product query is required'});return searchPrice(db,{type:'product',query:input.query.trim()},{maxAgeHours:requestedMaxAgeHours(req.query)});}const required=['origin','destination','departure_date'] as const;if(required.some(field=>typeof input[field]!=='string'||!input[field].trim()))return reply.code(400).send({status:'invalid_request',error:'origin, destination, and departure_date are required'});if(!isIsoDate(input.departure_date)||input.return_date&&!isIsoDate(input.return_date))return reply.code(400).send({status:'invalid_request',error:'flight dates must be valid YYYY-MM-DD values'});const cabins=['economy','premium_economy','business','first'] as const;if(input.cabin!==undefined&&!cabins.includes(input.cabin))return reply.code(400).send({status:'invalid_request',error:'unsupported cabin'});const cabin=input.cabin||'economy',adults=Number(input.adults||1);if(!Number.isInteger(adults)||adults<1||adults>9)return reply.code(400).send({status:'invalid_request',error:'adults must be an integer from 1 to 9'});return searchPrice(db,{type:'flight',origin:input.origin,destination:input.destination,departure_date:input.departure_date,...(input.return_date?{return_date:input.return_date}:{}),cabin,adults},{allowDemoFlights:isDemo});});
  const notImplemented=(category:string)=>({status:'not_implemented',category,dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,schema:{subject:{type:category},quote:{amount_minor:null,currency:null},provider:null,conditions:[],observed_at:null,expires_at:null},data:null});
  app.get('/v1/fx',()=>notImplemented('fx'));app.get('/v1/flights',async(req)=>{const query=req.query as any;if(!query.origin||!query.destination||!query.departure_date)return notImplemented('flight');return searchPrice(db,{type:'flight',origin:String(query.origin),destination:String(query.destination),departure_date:String(query.departure_date),return_date:query.return_date?String(query.return_date):undefined,cabin:query.cabin||'economy',adults:Number(query.adults||1)},{allowDemoFlights:isDemo});});
  app.all('/mcp',async(req,reply)=>{const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});reply.raw.on('close',()=>transport.close());await createMcpServer(db).connect(transport);await transport.handleRequest(req.raw,reply.raw,(req as any).body);reply.hijack()});
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
