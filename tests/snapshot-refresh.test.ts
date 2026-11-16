import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySnapshotRefresh } from '../scripts/verify-snapshot-refresh.mjs';

const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true})});

function databases(sources:string[]){
  const directory=mkdtempSync(join(tmpdir(),'pricemcp-refresh-'));directories.push(directory);
  const sourcePath=join(directory,'source.db'),snapshotPath=join(directory,'snapshot.db');
  const observedAt=new Date().toISOString(),refreshStartedAt=new Date(Date.now()-60_000).toISOString();
  const source=new DatabaseSync(sourcePath);
  source.exec(`
    CREATE TABLE collection_runs (id INTEGER PRIMARY KEY, source TEXT, started_at TEXT, status TEXT);
    CREATE TABLE price_observations (id INTEGER PRIMARY KEY, run_id INTEGER, collection_status TEXT);
  `);
  for(const [index,name] of sources.entries()){
    source.prepare('INSERT INTO collection_runs VALUES(?,?,?,?)').run(index+1,name,observedAt,'success');
    source.prepare('INSERT INTO price_observations VALUES(?,?,?)').run(index+1,index+1,'success');
  }
  source.close();
  const snapshot=new DatabaseSync(snapshotPath);
  snapshot.exec(`
    CREATE TABLE offers (id INTEGER PRIMARY KEY, available INTEGER, observed_at TEXT);
    CREATE TABLE price_observations (id INTEGER PRIMARY KEY, run_id INTEGER, raw_payload_json TEXT);
  `);
  snapshot.prepare('INSERT INTO offers VALUES(1,1,?)').run(observedAt);
  snapshot.prepare('INSERT INTO price_observations VALUES(1,NULL,?)').run('{"seller":"fixture"}');
  snapshot.close();
  return {sourcePath,snapshotPath,refreshStartedAt};
}

describe('snapshot refresh collector policy',()=>{
  it('does not accept evidence from before this refresh',()=>{
    const fixture=databases(['apple-us','best-buy-us']);
    const source=new DatabaseSync(fixture.sourcePath);source.exec("UPDATE collection_runs SET started_at='2020-01-01T00:00:00Z'");source.close();
    expect(()=>verifySnapshotRefresh(fixture)).toThrow(/missingRequired.*apple-us/);
  });
  it('does not reuse an earlier success after a later failed run',()=>{
    const fixture=databases(['apple-us','best-buy-us']);
    const source=new DatabaseSync(fixture.sourcePath);source.prepare('INSERT INTO collection_runs VALUES(?,?,?,?)').run(3,'best-buy-us',new Date().toISOString(),'failed');source.close();
    expect(()=>verifySnapshotRefresh(fixture)).toThrow(/missingRequired.*best-buy-us/);
  });
  it('rejects stale snapshot offers even when collectors succeeded',()=>{
    const fixture=databases(['apple-us','best-buy-us']);const snapshot=new DatabaseSync(fixture.snapshotPath);snapshot.exec("UPDATE offers SET observed_at='2020-01-01T00:00:00Z'");snapshot.close();
    expect(()=>verifySnapshotRefresh(fixture)).toThrow(/Unsafe snapshot/);
  });
  it('publishes when Apple and Best Buy succeed even if Amazon fails',()=>{
    const fixture=databases(['apple-us','best-buy-us']);
    const source=new DatabaseSync(fixture.sourcePath);
    source.prepare('INSERT INTO collection_runs VALUES(?,?,?,?)').run(3,'amazon-us',new Date().toISOString(),'failed');
    source.close();
    const result=verifySnapshotRefresh(fixture);
    expect(result.missingRequired).toEqual([]);
    expect(result.missingOptional).toEqual(['amazon-us']);
  });

  it('reports no missing collectors when Amazon also succeeds',()=>{
    const result=verifySnapshotRefresh(databases(['apple-us','best-buy-us','amazon-us']));
    expect(result.missingRequired).toEqual([]);
    expect(result.missingOptional).toEqual([]);
  });

  it('blocks publication when a required collector has no accepted offer',()=>{
    expect(()=>verifySnapshotRefresh(databases(['apple-us','amazon-us']))).toThrow(/missingRequired.*best-buy-us/);
  });
});
