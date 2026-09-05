import { DatabaseSync } from 'node:sqlite';

const scalar = (db, sql, ...params) => Number(db.prepare(sql).get(...params).value);
const requiredSources = ['apple-us', 'best-buy-us', 'amazon-us'];

const source = new DatabaseSync('data/pricemcp.db', { readOnly: true });
const collectors = Object.fromEntries(requiredSources.map(name => [name, scalar(source, `
  SELECT count(*) value
  FROM price_observations po
  JOIN collection_runs cr ON cr.id = po.run_id
  WHERE cr.source = ?
    AND cr.status IN ('success', 'partial')
    AND po.collection_status = 'success'
    AND julianday(po.observed_at) >= julianday('now', '-1 hour')
`, name)]));
source.close();

const snapshot = new DatabaseSync('data/vercel-snapshot.db', { readOnly: true });
const summary = {
  integrity: snapshot.prepare('PRAGMA integrity_check').get().integrity_check,
  offers: scalar(snapshot, 'SELECT count(*) value FROM offers'),
  observations: scalar(snapshot, 'SELECT count(*) value FROM price_observations'),
  fresh: scalar(snapshot, "SELECT count(*) value FROM offers WHERE available=1 AND julianday(observed_at)>=julianday('now','-24 hours')"),
  unsafe: scalar(snapshot, "SELECT count(*) value FROM price_observations WHERE run_id IS NOT NULL OR raw_payload_json LIKE '%token%' OR raw_payload_json LIKE '%secret%'")
};
snapshot.close();

const missing = Object.entries(collectors).filter(([, count]) => count < 1).map(([name]) => name);
if (missing.length || summary.integrity !== 'ok' || summary.offers < 1 || summary.offers !== summary.observations || summary.fresh < 1 || summary.unsafe > 0) {
  throw new Error(`Unsafe snapshot refresh: ${JSON.stringify({ collectors, missing, ...summary })}`);
}
console.log(JSON.stringify({ collectors, ...summary }));
