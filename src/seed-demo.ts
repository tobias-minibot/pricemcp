import { openDatabase, recordCollection, seed } from './db.js';
import { demoCatalog, demoDataset, demoMerchants, demoOfficialPrices } from './demo-catalog.js';
import type { CollectorResult, RawObservation } from './types.js';
import { basename, resolve } from 'node:path';

const path=process.env.PRICEMCP_DB||'./data/pricemcp-demo.db';
const filename=basename(resolve(path));
if(!/^pricemcp-demo(?:[-._][a-z0-9-]+)?\.db$/i.test(filename))throw new Error(`Refusing to reset a non-demo database: ${path}`);
const db=openDatabase(path);
const nonDemoProducts=Number((db.prepare('SELECT count(*) n FROM products WHERE dataset != ? OR synthetic != 1').get(demoDataset) as any).n);
if(nonDemoProducts)throw new Error(`Refusing to reset a database containing ${nonDemoProducts} non-demo products: ${path}`);

// Take the write lock before wiping, and disable connection-local FK enforcement only for the
// reset transaction. Always restore both transaction and FK state if any statement fails.
let resetting=false;
db.exec('PRAGMA foreign_keys=OFF;');
try{
  db.exec('BEGIN IMMEDIATE;');
  resetting=true;
  db.exec('DELETE FROM decision_records; DELETE FROM offers; DELETE FROM price_observations; DELETE FROM collection_runs; DELETE FROM aliases; DELETE FROM products; DELETE FROM merchants; DELETE FROM schema_meta;');
  db.exec('COMMIT;');
  resetting=false;
}catch(error){
  if(resetting)db.exec('ROLLBACK;');
  throw error;
}finally{
  db.exec('PRAGMA foreign_keys=ON;');
}
seed(db,demoCatalog,demoMerchants);

const now=Date.now();
const at=(offsetMs:number)=>new Date(now+offsetMs).toISOString();
const price=(base:number,multiplier:number)=>Math.round(base*multiplier);
const observation=(productId:string,merchantId:string,amount:number,scenario:string,observedAt:string,options:Partial<RawObservation>={}):RawObservation=>({
  source:`demo-${scenario}`,source_method:scenario==='history'?'synthetic_history_fixture':'synthetic_fixture',merchant_id:merchantId,
  source_product_id:`${merchantId}-${productId}`,url:`https://example.invalid/${demoDataset}/${merchantId}/${productId}`,
  observed_at:observedAt,title:demoCatalog.find(x=>x.id===productId)!.name,raw_price:`$${(amount/100).toFixed(2)}`,currency:'USD',price_minor:amount,
  shipping_minor:0,available:true,condition:'new',membership_required:false,matched_product_id:productId,match_confidence:1,collection_status:'success',
  dataset:demoDataset,synthetic:true,raw_payload:{synthetic:true,dataset:demoDataset,scenario,generated_at:new Date(now).toISOString()},...options
});

const byMerchant=new Map<string,RawObservation[]>();
const add=(o:RawObservation)=>byMerchant.set(o.merchant_id,[...(byMerchant.get(o.merchant_id)||[]),o]);
for(const p of demoCatalog){
  const base=demoOfficialPrices[p.id]!;
  add(observation(p.id,'demo-brand-direct',base,'official',at(-15*60_000)));
  const historyMultipliers=[.98,.96,.97,.94,.92,.89],historyDays=[-29,-21,-14,-7,-2,0];
  historyMultipliers.forEach((multiplier,index)=>add(observation(p.id,'demo-northstar',price(base,multiplier),'history',historyDays[index]===0?at(-2*60_000):at(historyDays[index]!*86_400_000))));
  add(observation(p.id,'demo-club-warehouse',price(base,.86),'membership',at(-12*60_000),{membership_required:true}));
  add(observation(p.id,'demo-marketsquare',price(base,.8),'marketplace',at(-10*60_000),{shipping_minor:null}));
  add(observation(p.id,'demo-outlet-depot',price(base,.78),'unavailable',at(-8*60_000),{available:false,collection_status:'unavailable'}));
  add(observation(p.id,'demo-harbor',price(base,.75),'stale',at(-30*3_600_000)));
}
for(const [merchantId,observations] of byMerchant){
  const result:CollectorResult={source:`${merchantId}-synthetic`,method:observations[0]!.source_method,status:'success',observations,matched_products:demoCatalog.length,errors:[]};
  recordCollection(db,result);
}
db.prepare("INSERT INTO schema_meta(key,value) VALUES('dataset',?)").run(demoDataset);
db.prepare("INSERT INTO schema_meta(key,value) VALUES('synthetic','true')").run();
db.prepare("INSERT INTO schema_meta(key,value) VALUES('generated_at',?)").run(new Date(now).toISOString());
console.log(JSON.stringify({status:'seeded',dataset:demoDataset,synthetic:true,products:demoCatalog.length,merchants:demoMerchants.length,observations:Number((db.prepare('SELECT count(*) n FROM price_observations').get() as any).n),offers:Number((db.prepare('SELECT count(*) n FROM offers').get() as any).n),database:path},null,2));
