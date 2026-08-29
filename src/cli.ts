import { health, openDatabase, recordCollection, seed } from './db.js';
import { runCollectors } from './collectors.js';
import { evaluateCollectionHealth, notifyCollectionIssues } from './monitor.js';

const command=process.argv[2]||'collect'; const db=openDatabase(); seed(db);
if(command==='seed'){console.log(JSON.stringify({status:'seeded'},null,2));process.exit(0)}
if(command==='collect'){
  const results=await runCollectors();
  for(const item of results)recordCollection(db,item);
  const issues=evaluateCollectionHealth(health(db));const alert=await notifyCollectionIssues(issues);
  console.log(JSON.stringify({results:results.map(r=>({source:r.source,status:r.status,observations:r.observations.length,matched_products:r.matched_products,successful_offers:r.observations.filter(o=>o.collection_status==='success').length,errors:r.errors})),monitor:{issues,alert}},null,2));
  process.exit(results.every(r=>r.status==='failed')?1:0);
}
console.error(`Unknown command: ${command}`);process.exit(2);
