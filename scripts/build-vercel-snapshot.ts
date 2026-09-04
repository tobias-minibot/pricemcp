import { DatabaseSync } from 'node:sqlite';
import { renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '../src/db.js';

const sourcePath=resolve(process.env.PRICEMCP_DB||'./data/pricemcp.db');
const targetPath=resolve(process.env.PRICEMCP_VERCEL_SNAPSHOT||'./data/vercel-snapshot.db');
const stagingPath=`${targetPath}.next`;
if(sourcePath===targetPath)throw new Error('Snapshot source and target must be different files');

const quote=(value:string)=>`"${value.replaceAll('"','""')}"`;
const tableColumns=(db:DatabaseSync,table:string)=>(db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{name:string}>).map(row=>row.name);
const copyTable=(db:DatabaseSync,table:string,selectFrom=quote(table))=>{
  const columns=tableColumns(db,table),list=columns.map(quote).join(',');
  db.exec(`INSERT INTO snapshot.${quote(table)} (${list}) SELECT ${list} FROM main.${selectFrom}`);
};

rmSync(stagingPath,{force:true});
openDatabase(stagingPath).close();
const source=openDatabase(sourcePath);
try{
  source.prepare('ATTACH DATABASE ? AS snapshot').run(stagingPath);
  source.exec('BEGIN');
  copyTable(source,'products');
  copyTable(source,'aliases');
  copyTable(source,'merchants');
  const observationColumns=tableColumns(source,'price_observations'),observationList=observationColumns.map(quote).join(',');
  const observationSelect=observationColumns.map(column=>column==='run_id'?'NULL':`po.${quote(column)}`).join(',');
  source.exec(`INSERT INTO snapshot.price_observations (${observationList}) SELECT ${observationSelect} FROM main.price_observations po WHERE po.id IN (SELECT observation_id FROM main.offers)`);
  copyTable(source,'offers');
  copyTable(source,'schema_meta');
  source.exec('COMMIT');
  source.exec('DETACH DATABASE snapshot');
}catch(error){
  try{source.exec('ROLLBACK')}catch{}
  source.close();
  rmSync(stagingPath,{force:true});
  throw error;
}
source.close();

const snapshot=openDatabase(stagingPath);
let summary:{products:number;merchants:number;offers:number;observations:number;collection_runs:number;decisions:number;last_refresh:string|null};
try{
  snapshot.exec('PRAGMA query_only=ON');
  const scalar=(sql:string)=>Number((snapshot.prepare(sql).get() as Record<string,number>).value);
  const integrity=String((snapshot.prepare('PRAGMA integrity_check').get() as Record<string,string>).integrity_check);
  const foreignKeyErrors=(snapshot.prepare('PRAGMA foreign_key_check').all() as unknown[]).length;
  summary={
    products:scalar('SELECT count(*) value FROM products'),
    merchants:scalar('SELECT count(*) value FROM merchants'),
    offers:scalar('SELECT count(*) value FROM offers'),
    observations:scalar('SELECT count(*) value FROM price_observations'),
    collection_runs:scalar('SELECT count(*) value FROM collection_runs'),
    decisions:scalar('SELECT count(*) value FROM decision_records'),
    last_refresh:(snapshot.prepare('SELECT max(observed_at) value FROM offers').get() as Record<string,string|null>).value
  };
  if(integrity!=='ok'||foreignKeyErrors||summary.offers<1||summary.offers!==summary.observations||summary.collection_runs||summary.decisions)throw new Error(`Unsafe snapshot export: ${JSON.stringify({integrity,foreignKeyErrors,...summary})}`);
}catch(error){
  snapshot.close();
  rmSync(stagingPath,{force:true});
  throw error;
}
snapshot.close();
try{renameSync(stagingPath,targetPath)}catch(error){rmSync(stagingPath,{force:true});throw error}
console.log(JSON.stringify({status:'ok',source:sourcePath,target:targetPath,...summary},null,2));
