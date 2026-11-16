import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const scalar = (db, sql, ...params) => Number(db.prepare(sql).get(...params).value);
const requiredSources = ['apple-us', 'best-buy-us'];
const optionalSources = ['amazon-us'];
const monitoredSources = [...requiredSources, ...optionalSources];
export function verifySnapshotRefresh({
  sourcePath = process.env.PRICEMCP_DB || 'data/pricemcp.db',
  snapshotPath = process.env.PRICEMCP_VERCEL_SNAPSHOT || 'data/vercel-snapshot.db',
  refreshStartedAt = process.env.PRICEMCP_REFRESH_STARTED_AT
} = {}) {
  if (!refreshStartedAt || !Number.isFinite(Date.parse(refreshStartedAt))) throw new Error('PRICEMCP_REFRESH_STARTED_AT must be a valid ISO-8601 timestamp');

  const source = new DatabaseSync(sourcePath, { readOnly: true });
  let collectors;
  try {
    collectors = Object.fromEntries(monitoredSources.map(name => [name, scalar(source, `
      WITH current_run AS (
        SELECT id, status FROM collection_runs
        WHERE source = ? AND julianday(started_at) >= julianday(?)
        ORDER BY id DESC LIMIT 1
      )
      SELECT count(*) value
      FROM price_observations po
      JOIN current_run cr ON cr.id = po.run_id
      WHERE cr.status IN ('success', 'partial')
        AND po.collection_status = 'success'
    `, name, refreshStartedAt)]));
  } finally {
    source.close();
  }

  const snapshot = new DatabaseSync(snapshotPath, { readOnly: true });
  let summary;
  try {
    summary = {
      integrity: snapshot.prepare('PRAGMA integrity_check').get().integrity_check,
      offers: scalar(snapshot, 'SELECT count(*) value FROM offers'),
      observations: scalar(snapshot, 'SELECT count(*) value FROM price_observations'),
      fresh: scalar(snapshot, "SELECT count(*) value FROM offers WHERE available=1 AND julianday(observed_at)>=julianday('now','-24 hours')"),
      unsafe: scalar(snapshot, "SELECT count(*) value FROM price_observations WHERE run_id IS NOT NULL OR raw_payload_json LIKE '%token%' OR raw_payload_json LIKE '%secret%'")
    };
  } finally {
    snapshot.close();
  }

  const missingRequired = requiredSources.filter(name => collectors[name] < 1);
  const missingOptional = optionalSources.filter(name => collectors[name] < 1);
  const result = { collectors, missingRequired, missingOptional, ...summary };
  if (missingRequired.length || summary.integrity !== 'ok' || summary.offers < 1 || summary.offers !== summary.observations || summary.fresh < 1 || summary.unsafe > 0) {
    throw new Error(`Unsafe snapshot refresh: ${JSON.stringify(result)}`);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifySnapshotRefresh()));
}
