export interface MonitorIssue { source:string; kind:'collector_failed'|'refresh_overdue'|'selector_drift'; detail:string }

export function evaluateCollectionHealth(snapshot:any):MonitorIssue[]{
  const issues:MonitorIssue[]=[];
  for(const source of snapshot.collector_status||[]){
    if(source.status==='failed')issues.push({source:source.source,kind:'collector_failed',detail:(source.errors||[]).join('; ')||'latest run failed'});
    if(source.sla_status==='overdue')issues.push({source:source.source,kind:'refresh_overdue',detail:`last success is ${source.last_success_age_seconds??'unknown'}s old; SLA ${source.sla_seconds}s`});
    if((source.errors||[]).some((e:string)=>/bootstrap|schema drift|not found|malformed/i.test(e)))issues.push({source:source.source,kind:'selector_drift',detail:(source.errors||[]).join('; ')});
  }
  return issues;
}

export async function notifyCollectionIssues(issues:MonitorIssue[]):Promise<{configured:boolean;sent:boolean}>{
  const url=process.env.PRICEMCP_ALERT_WEBHOOK_URL;if(!url||!issues.length)return{configured:Boolean(url),sent:false};
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({service:'pricemcp',observed_at:new Date().toISOString(),issues}),signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new Error(`Alert webhook HTTP ${response.status}`);
  return{configured:true,sent:true};
}
