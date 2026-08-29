import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { catalog, merchants } from './catalog.js';
import { extractAttributes, freshness, normalizeText } from './normalize.js';
import type { CatalogProduct, CollectorResult, RawObservation } from './types.js';

export type Db = DatabaseSync;

export function openDatabase(path = process.env.PRICEMCP_DB || './data/pricemcp.db'): Db {
  const file = path === ':memory:' ? path : resolve(path);
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, brand TEXT NOT NULL, category TEXT NOT NULL, family TEXT NOT NULL,
      name TEXT NOT NULL, model TEXT, attributes_json TEXT NOT NULL, official_url TEXT NOT NULL,
      priority TEXT NOT NULL, active INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      dataset TEXT NOT NULL DEFAULT 'live', synthetic INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL REFERENCES products(id),
      alias TEXT NOT NULL, normalized_alias TEXT NOT NULL, UNIQUE(product_id, normalized_alias)
    );
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, verified INTEGER NOT NULL, authorized INTEGER NOT NULL,
      trust_score REAL NOT NULL, source_type TEXT NOT NULL, shipping_reliability REAL NOT NULL,
      marketplace_seller INTEGER NOT NULL, notes TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collection_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, method TEXT NOT NULL,
      started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, matched_products INTEGER DEFAULT 0,
      captured_offers INTEGER DEFAULT 0, errors_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS price_observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER REFERENCES collection_runs(id),
      product_id TEXT REFERENCES products(id), merchant_id TEXT NOT NULL REFERENCES merchants(id),
      source TEXT NOT NULL, source_method TEXT NOT NULL, source_product_id TEXT NOT NULL, url TEXT NOT NULL,
      observed_at TEXT NOT NULL, title TEXT NOT NULL, raw_price TEXT NOT NULL, currency TEXT NOT NULL,
      price_minor INTEGER, shipping_minor INTEGER, normalized_total_minor INTEGER, available INTEGER NOT NULL,
      condition TEXT NOT NULL, membership_required INTEGER NOT NULL DEFAULT 0, match_confidence REAL NOT NULL,
      collection_status TEXT NOT NULL, raw_payload_json TEXT, created_at TEXT NOT NULL,
      dataset TEXT NOT NULL DEFAULT 'live', synthetic INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_obs_product_time ON price_observations(product_id, observed_at DESC);
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, product_id TEXT NOT NULL REFERENCES products(id),
      merchant_id TEXT NOT NULL REFERENCES merchants(id), source_product_id TEXT NOT NULL, observation_id INTEGER NOT NULL REFERENCES price_observations(id),
      url TEXT NOT NULL, currency TEXT NOT NULL, price_minor INTEGER NOT NULL, shipping_minor INTEGER,
      total_minor INTEGER NOT NULL, available INTEGER NOT NULL, condition TEXT NOT NULL,
      membership_required INTEGER NOT NULL, observed_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(product_id, merchant_id, source_product_id)
    );
    CREATE TABLE IF NOT EXISTS decision_records (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), merchant_id TEXT NOT NULL REFERENCES merchants(id),
      amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, rationale TEXT NOT NULL,
      evidence_observed_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_created ON decision_records(created_at DESC);
    CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const ensureColumn=(table:string,column:string,declaration:string)=>{const columns=db.prepare(`PRAGMA table_info(${table})`).all() as any[];if(!columns.some(x=>x.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`)};
  ensureColumn('products','dataset',"TEXT NOT NULL DEFAULT 'live'");
  ensureColumn('products','synthetic','INTEGER NOT NULL DEFAULT 0');
  ensureColumn('price_observations','dataset',"TEXT NOT NULL DEFAULT 'live'");
  ensureColumn('price_observations','synthetic','INTEGER NOT NULL DEFAULT 0');
}

export function seed(db: Db, products:CatalogProduct[]=catalog, merchantSeeds=merchants): void {
  const now = new Date().toISOString();
  const productStmt = db.prepare(`INSERT INTO products(id,brand,category,family,name,model,attributes_json,official_url,priority,active,created_at,updated_at,dataset,synthetic) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET brand=excluded.brand,category=excluded.category,family=excluded.family,name=excluded.name,
    attributes_json=excluded.attributes_json,official_url=excluded.official_url,priority=excluded.priority,active=excluded.active,updated_at=excluded.updated_at,dataset=excluded.dataset,synthetic=excluded.synthetic`);
  const aliasStmt = db.prepare('INSERT OR IGNORE INTO aliases(product_id,alias,normalized_alias) VALUES(?,?,?)');
  for (const x of products) {
    productStmt.run(x.id,x.brand,x.category,x.family,x.name,x.model ?? null,JSON.stringify(x.attributes),x.official_url,x.priority,x.active?1:0,now,now,x.dataset??'live',x.synthetic?1:0);
    for (const alias of [x.name, x.id, ...x.aliases]) aliasStmt.run(x.id,alias,normalizeText(alias));
  }
  const merchantStmt = db.prepare(`INSERT INTO merchants VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,verified=excluded.verified,authorized=excluded.authorized,trust_score=excluded.trust_score,
    source_type=excluded.source_type,shipping_reliability=excluded.shipping_reliability,marketplace_seller=excluded.marketplace_seller,notes=excluded.notes`);
  for (const m of merchantSeeds) merchantStmt.run(m.id,m.name,m.verified?1:0,m.authorized?1:0,m.trust_score,m.source_type,m.shipping_reliability,m.marketplace_seller?1:0,m.notes);
  // A previous prototype accepted Amazon search cards without seller-of-record
  // evidence. Preserve those observations, but retire them from current/history
  // calculations now that the Amazon policy requires an explicit PDP buy box.
  db.prepare("UPDATE price_observations SET collection_status='rejected_policy' WHERE merchant_id='amazon' AND source_method='search_html'").run();
  db.prepare("DELETE FROM offers WHERE merchant_id='amazon' AND observation_id IN (SELECT id FROM price_observations WHERE source_method!='curated_pdp_html')").run();
  db.prepare(`INSERT INTO schema_meta VALUES('catalog_verified_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(now);
}

export function listCatalog(db: Db): CatalogProduct[] {
  return (db.prepare('SELECT * FROM products').all() as any[]).map(row => ({...row,active:!!row.active,synthetic:!!row.synthetic,attributes:JSON.parse(row.attributes_json),aliases:[]}));
}

export function listFeaturedProducts(db:Db,limit=6):any[]{return (db.prepare("SELECT * FROM products WHERE priority='priority' ORDER BY name LIMIT ?").all(limit) as any[]).map(row=>({...row,active:!!row.active,synthetic:!!row.synthetic,attributes:JSON.parse(row.attributes_json),score:1}))}

export function recordCollection(db: Db, result: CollectorResult): number {
  const started = result.observations[0]?.observed_at || new Date().toISOString();
  const run = db.prepare('INSERT INTO collection_runs(source,method,started_at,status,errors_json) VALUES(?,?,?,?,?)').run(result.source,result.method,started,'running','[]');
  const runId = Number(run.lastInsertRowid);
  // A collector run is a snapshot for every canonical product/merchant pair it
  // actually saw. Clear only those projections before inserting the new set so
  // color/part-number churn cannot leave duplicate "current" offers behind.
  const refreshedPairs=new Set(result.observations.filter(o=>o.matched_product_id&&(o.collection_status==='success'||o.collection_status==='unavailable')).map(o=>`${o.matched_product_id}\0${o.merchant_id}`));
  for(const pair of refreshedPairs){const separator=pair.indexOf('\0');const productId=pair.slice(0,separator),merchantId=pair.slice(separator+1);db.prepare('DELETE FROM offers WHERE product_id=? AND merchant_id=?').run(productId,merchantId)}
  for (const observation of result.observations) appendObservation(db, runId, observation);
  db.prepare(`UPDATE collection_runs SET completed_at=?,status=?,matched_products=?,captured_offers=?,errors_json=? WHERE id=?`).run(
    new Date().toISOString(),result.status,result.matched_products,result.observations.filter(o=>o.collection_status==='success').length,JSON.stringify(result.errors),runId);
  return runId;
}

export function appendObservation(db: Db, runId: number | null, o: RawObservation): number {
  const total = Number.isFinite(o.price_minor) ? o.price_minor + (o.shipping_minor || 0) : null;
  const result = db.prepare(`INSERT INTO price_observations(run_id,product_id,merchant_id,source,source_method,source_product_id,url,observed_at,title,raw_price,currency,price_minor,shipping_minor,normalized_total_minor,available,condition,membership_required,match_confidence,collection_status,raw_payload_json,created_at,dataset,synthetic)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(runId,o.matched_product_id ?? null,o.merchant_id,o.source,o.source_method,o.source_product_id,o.url,o.observed_at,o.title,o.raw_price,o.currency,Number.isFinite(o.price_minor)?o.price_minor:null,o.shipping_minor??null,total,o.available?1:0,o.condition,o.membership_required?1:0,o.match_confidence,o.collection_status,o.raw_payload?JSON.stringify(o.raw_payload):null,new Date().toISOString(),o.dataset??'live',o.synthetic?1:0);
  const id = Number(result.lastInsertRowid);
  if (o.matched_product_id && (o.collection_status === 'success' || o.collection_status === 'unavailable') && total !== null) {
    db.prepare(`INSERT INTO offers(product_id,merchant_id,source_product_id,observation_id,url,currency,price_minor,shipping_minor,total_minor,available,condition,membership_required,observed_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_id,merchant_id,source_product_id) DO UPDATE SET
      observation_id=excluded.observation_id,url=excluded.url,currency=excluded.currency,price_minor=excluded.price_minor,shipping_minor=excluded.shipping_minor,total_minor=excluded.total_minor,available=excluded.available,condition=excluded.condition,membership_required=excluded.membership_required,observed_at=excluded.observed_at,updated_at=excluded.updated_at`).run(
      o.matched_product_id,o.merchant_id,o.source_product_id,id,o.url,o.currency,o.price_minor,o.shipping_minor??null,total,o.available?1:0,o.condition,o.membership_required?1:0,o.observed_at,new Date().toISOString());
  }
  return id;
}

export function searchProducts(db: Db, query: string, limit = 20): any[] {
  const q = normalizeText(query);
  const tokens = q.split(' ').filter(Boolean);
  const requested=extractAttributes(query);
  if (!tokens.length) return [];
  const rows = db.prepare(`SELECT p.*, GROUP_CONCAT(a.normalized_alias,' ') aliases FROM products p LEFT JOIN aliases a ON a.product_id=p.id GROUP BY p.id`).all() as any[];
  return rows.map(row => {
    const hay = normalizeText(`${row.name} ${row.id} ${row.aliases} ${row.attributes_json}`);
    const matched = tokens.filter(t => hay.includes(t)).length;
    const coverage=matched/tokens.length;
    const attributes=JSON.parse(row.attributes_json);
    const conflicts=Object.entries(requested).filter(([key,value])=>attributes[key]!==undefined&&String(attributes[key]).toUpperCase()!==String(value).toUpperCase()).length;
    const phraseBonus=q.length>2&&hay.includes(q)?0.25:0;
    return {...row,attributes,active:!!row.active,synthetic:!!row.synthetic,score:Number((coverage+phraseBonus-conflicts*0.75).toFixed(3))};
  }).filter(x=>x.score>=0.5).sort((a,b)=>b.score-a.score || Number(b.active)-Number(a.active) || a.name.localeCompare(b.name)).slice(0,limit);
}

export function getProduct(db: Db, id: string): any | null {
  const row = db.prepare('SELECT * FROM products WHERE id=?').get(id) as any;
  return row ? {...row,active:!!row.active,synthetic:!!row.synthetic,attributes:JSON.parse(row.attributes_json)} : null;
}

export function getOffers(db: Db, productId: string, maxAgeHours?: number): any[] {
  const rows = db.prepare(`SELECT o.*,po.source_method,po.dataset,po.synthetic,m.name merchant_name,m.verified,m.authorized,m.trust_score,m.source_type,m.shipping_reliability,m.marketplace_seller,m.notes merchant_notes
    FROM offers o JOIN merchants m ON m.id=o.merchant_id JOIN price_observations po ON po.id=o.observation_id WHERE o.product_id=? ORDER BY o.total_minor ASC,m.trust_score DESC`).all(productId) as any[];
  return rows.map(row=>({...row,available:!!row.available,verified:!!row.verified,authorized:!!row.authorized,marketplace_seller:!!row.marketplace_seller,membership_required:!!row.membership_required,synthetic:!!row.synthetic,...freshness(row.observed_at),trusted:!!row.verified&&!!row.authorized&&row.trust_score>=0.75&&!row.marketplace_seller&&row.condition==='new'}))
    .filter(row=>maxAgeHours===undefined || row.age_seconds <= maxAgeHours*3600);
}

export function recordDecision(db:Db,productId:string,merchantId:string,rationale:string):any{
  const product=getProduct(db,productId);if(!product)throw new Error(`Unknown product: ${productId}`);
  const offer=getOffers(db,productId,6).find(o=>o.merchant_id===merchantId&&o.available&&o.freshness_status!=='stale'&&o.trusted&&!o.membership_required&&o.condition==='new');
  if(!offer)throw new Error(`No fresh trusted unconditional new offer for ${productId} from ${merchantId}`);
  const record={id:randomUUID(),product_id:productId,merchant_id:merchantId,amount_minor:offer.total_minor,currency:offer.currency,rationale,evidence_observed_at:offer.observed_at,created_at:new Date().toISOString()};
  db.prepare('INSERT INTO decision_records(id,product_id,merchant_id,amount_minor,currency,rationale,evidence_observed_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(record.id,record.product_id,record.merchant_id,record.amount_minor,record.currency,record.rationale,record.evidence_observed_at,record.created_at);
  return record;
}

export function listDecisions(db:Db,limit=20):any[]{return db.prepare('SELECT * FROM decision_records ORDER BY created_at DESC LIMIT ?').all(limit) as any[]}

export function bestPrice(db: Db, productId: string, maxAgeHours?: number): any {
  const offers = getOffers(db,productId,maxAgeHours).filter(o=>o.available&&o.freshness_status!=='stale');
  const cheapest = offers[0] || null;
  const bestTrusted = offers.filter(o=>o.trusted&&!o.membership_required).sort((a,b)=>a.total_minor-b.total_minor || b.trust_score-a.trust_score)[0] || null;
  const bestMembership = offers.filter(o=>o.trusted&&o.membership_required).sort((a,b)=>a.total_minor-b.total_minor || b.trust_score-a.trust_score)[0] || null;
  const official = offers.filter(o=>o.source_type==='official').sort((a,b)=>b.observed_at.localeCompare(a.observed_at))[0] || null;
  return { product_id:productId, cheapest_offer:cheapest, best_trusted_offer:bestTrusted, best_membership_offer:bestMembership, official_price:official,
    savings_vs_official_minor: official&&bestTrusted ? official.total_minor-bestTrusted.total_minor : null,
    evidence_count:offers.length, max_age_hours:maxAgeHours??null };
}

export function history(db: Db, productId: string, days = 30): any {
  const since = new Date(Date.now()-days*86400_000).toISOString();
  const product=getProduct(db,productId);
  const syntheticFilter=product?.synthetic?" AND po.source_method='synthetic_history_fixture'":'';
  const points = db.prepare(`SELECT po.*,m.name merchant_name FROM price_observations po JOIN merchants m ON m.id=po.merchant_id WHERE product_id=? AND observed_at>=? AND collection_status='success'${syntheticFilter} ORDER BY observed_at DESC,po.id DESC`).all(productId,since) as any[];
  const current=points[0]||null, previous=points.find((p,i)=>i>0&&p.normalized_total_minor!==current?.normalized_total_minor)||points[1]||null;
  const values=points.map(p=>p.normalized_total_minor).filter(Number.isFinite);
  const change=current&&previous?current.normalized_total_minor-previous.normalized_total_minor:null;
  return {product_id:productId,days,current,previous,change_minor:change,change_percent:change!==null&&previous?.normalized_total_minor?Number((change/previous.normalized_total_minor*100).toFixed(2)):null,low_30d_minor:values.length?Math.min(...values):null,high_30d_minor:values.length?Math.max(...values):null,points};
}

export function health(db: Db): any {
  const checkedAt=new Date();
  const scalar=(sql:string)=>Number((db.prepare(sql).get() as any).n);
  const runs=db.prepare('SELECT * FROM collection_runs ORDER BY id DESC LIMIT 20').all() as any[];
  const sources=[...new Set(runs.map(r=>r.source))];
  const collector_status=sources.map(source=>{const latest=runs.find(r=>r.source===source);const lastSuccess=db.prepare("SELECT completed_at FROM collection_runs WHERE source=? AND status IN ('success','partial') ORDER BY id DESC LIMIT 1").get(source) as any;const slaSeconds=source==='amazon-us'?21600:source.includes('synthetic')?172800:7200;const ageSeconds=lastSuccess?.completed_at?Math.max(0,Math.floor((checkedAt.getTime()-Date.parse(lastSuccess.completed_at))/1000)):null;return{source,status:latest?.status??'never',last_run:latest?.completed_at??null,last_successful_run:lastSuccess?.completed_at??null,last_success_age_seconds:ageSeconds,sla_seconds:slaSeconds,sla_status:ageSeconds===null||ageSeconds>slaSeconds?'overdue':'within_sla',matched_products:latest?.matched_products??0,captured_offers:latest?.captured_offers??0,errors:JSON.parse(latest?.errors_json||'[]')}});
  const meta=Object.fromEntries((db.prepare('SELECT key,value FROM schema_meta').all() as any[]).map(x=>[x.key,x.value]));
  const degraded=collector_status.some(x=>x.status==='failed'||x.sla_status==='overdue');
  return {status:degraded?'degraded':'ok',checked_at:checkedAt.toISOString(),dataset:meta.dataset||'live',synthetic:meta.synthetic==='true',generated_at:meta.generated_at||null,counts:{products:scalar('SELECT count(*) n FROM products'),merchants:scalar('SELECT count(*) n FROM merchants'),current_offers:scalar('SELECT count(*) n FROM offers'),fresh_available_offers:scalar("SELECT count(*) n FROM offers WHERE available=1 AND julianday(observed_at)>=julianday('now','-24 hours')"),unavailable_offers:scalar('SELECT count(*) n FROM offers WHERE available=0'),stale_offers:scalar("SELECT count(*) n FROM offers WHERE julianday(observed_at)<julianday('now','-24 hours')")},last_refresh:(db.prepare('SELECT max(observed_at) value FROM offers').get() as any).value??null,collector_status,collector_runs:runs};
}
