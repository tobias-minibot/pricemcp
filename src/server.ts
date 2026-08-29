import Fastify from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { Cron } from 'croner';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { openDatabase, seed, searchProducts, getProduct, getOffers, bestPrice, history, health, recordCollection, listFeaturedProducts } from './db.js';
import { createMcpServer } from './mcp.js';
import { homePage, productPage, statusPage } from './web.js';
import { runCollectors, runPriorityCollectors } from './collectors.js';
import { evaluateCollectionHealth, notifyCollectionIssues } from './monitor.js';

export function buildApp(db=openDatabase()){
  const isDemo=process.env.PRICEMCP_DATASET==='pricemcp-demo-v1';if(!isDemo)seed(db);const app=Fastify({logger:true});
  const apiToken=process.env.PRICEMCP_API_TOKEN;
  if(apiToken)app.addHook('onRequest',async(req,reply)=>{
    if(req.url.startsWith('/internal/health'))return;
    const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    const valid=supplied.length===apiToken.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(apiToken));
    if(!valid)return reply.code(401).send({error:'unauthorized'});
  });
  const requestedMaxAgeHours=(query:any):number|undefined=>query.max_age!==undefined?Number(query.max_age)/3600:query.max_age_hours!==undefined?Number(query.max_age_hours):undefined;
  app.setErrorHandler((error,_req,reply)=>reply.code((error as any).statusCode||500).send({error:'request_failed',message:(error as Error).message}));
  app.get('/',(req,reply)=>{const q=String((req.query as any).q||'');reply.type('text/html').send(homePage(q?searchProducts(db,q):isDemo?listFeaturedProducts(db):[],q))});
  app.get('/products/:id',(req,reply)=>{const id=(req.params as any).id,p=getProduct(db,id);if(!p)return reply.code(404).type('text/html').send(homePage([],id));reply.type('text/html').send(productPage(p,getOffers(db,id),bestPrice(db,id),history(db,id)))});
  app.get('/status',(_req,reply)=>reply.type('text/html').send(statusPage(health(db))));
  app.get('/internal/health',()=>health(db));
  app.get('/v1/search',(req)=>{const q=String((req.query as any).q||'');return{dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,query:q,results:searchProducts(db,q),observed_scope:'US',currency:'USD'}});
  app.get('/v1/products/:id',(req,reply)=>{const p=getProduct(db,(req.params as any).id);return p||reply.code(404).send({error:'not_found'})});
  app.get('/v1/products/:id/offers',(req)=>{const id=(req.params as any).id,max=requestedMaxAgeHours(req.query);const all=getOffers(db,id),offers=max===undefined?all:getOffers(db,id,max);return{dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,product:getProduct(db,id),offers,max_age_seconds:max===undefined?null:max*3600,excluded_outside_max_age:all.length-offers.length}});
  app.get('/v1/products/:id/history',(req)=>history(db,(req.params as any).id,Number((req.query as any).days||30)));
  app.get('/v1/compare',(req)=>{const ids=String((req.query as any).ids||'').split(',').filter(Boolean);return{products:ids.map(id=>({product:getProduct(db,id),price:bestPrice(db,id)}))}});
  app.get('/v1/best-price/:id',(req)=>bestPrice(db,(req.params as any).id,requestedMaxAgeHours(req.query)));
  const notImplemented=(category:string)=>({status:'not_implemented',category,dataset:isDemo?'pricemcp-demo-v1':'live',synthetic:isDemo,schema:{subject:{type:category},quote:{amount_minor:null,currency:null},provider:null,conditions:[],observed_at:null,expires_at:null},data:null});
  app.get('/v1/fx',()=>notImplemented('fx'));app.get('/v1/flights',()=>notImplemented('flight'));
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
