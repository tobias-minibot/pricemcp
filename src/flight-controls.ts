type CacheEntry<T>={expiresAt:number;value:T};
type ProviderCircuit={consecutiveFailures:number;openUntil:number};

const cache=new Map<string,CacheEntry<unknown>>();
const inflight=new Map<string,Promise<unknown>>();
const providerCircuits=new Map<string,ProviderCircuit>();
let activeProviderSearches=0;
let budgetWindowStartedAt=Date.now();
let providerCallsInWindow=0;

const setting=(name:string,fallback:number,min:number,max:number):number=>{
  const raw=process.env[name];
  if(raw===undefined||raw==='')return fallback;
  const parsed=Number(raw);
  if(!Number.isInteger(parsed)||parsed<min||parsed>max)throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return parsed;
};

export const flightControlSettings=()=>{
  const testing=process.env.NODE_ENV==='test';
  return{
    cacheTtlSeconds:setting('PRICEMCP_FLIGHT_CACHE_TTL_SECONDS',testing?0:60,0,900),
    maxConcurrentSearches:setting('PRICEMCP_FLIGHT_MAX_CONCURRENT_SEARCHES',testing?1000:4,1,1000),
    providerCallsPerHour:setting('PRICEMCP_FLIGHT_PROVIDER_CALLS_PER_HOUR',testing?100000:120,1,100000),
    providerFailureThreshold:setting('PRICEMCP_FLIGHT_PROVIDER_FAILURE_THRESHOLD',3,1,100),
    providerCircuitCooldownSeconds:setting('PRICEMCP_FLIGHT_PROVIDER_CIRCUIT_COOLDOWN_SECONDS',60,1,3600)
  };
};

export async function controlledFlightProvider<T>(provider:string,run:()=>Promise<T>):Promise<T>{
  const settings=flightControlSettings(),now=Date.now(),current=providerCircuits.get(provider);
  if(current?.openUntil&&current.openUntil>now){
    const retryAfter=Math.max(1,Math.ceil((current.openUntil-now)/1000));
    throw new Error(`${provider} circuit open after ${current.consecutiveFailures} consecutive failures; retry after ${retryAfter} seconds`);
  }
  try{
    const value=await run();
    providerCircuits.delete(provider);
    return value;
  }catch(error){
    const failures=(providerCircuits.get(provider)?.consecutiveFailures||0)+1;
    providerCircuits.set(provider,{consecutiveFailures:failures,openUntil:failures>=settings.providerFailureThreshold?Date.now()+settings.providerCircuitCooldownSeconds*1000:0});
    throw error;
  }
}

export async function controlledFlightSearch<T>(key:string,providerCost:number,run:()=>Promise<T>):Promise<T>{
  const now=Date.now(),settings=flightControlSettings(),cached=cache.get(key) as CacheEntry<T>|undefined;
  if(cached&&cached.expiresAt>now)return cached.value;
  if(cached)cache.delete(key);
  const pending=inflight.get(key) as Promise<T>|undefined;
  if(pending)return pending;
  if(now-budgetWindowStartedAt>=3_600_000){budgetWindowStartedAt=now;providerCallsInWindow=0}
  if(activeProviderSearches>=settings.maxConcurrentSearches)throw new Error('Flight provider concurrency limit reached; retry shortly');
  if(providerCallsInWindow+providerCost>settings.providerCallsPerHour)throw new Error('Flight provider hourly request budget exhausted; retry after the budget window resets');
  providerCallsInWindow+=providerCost;
  activeProviderSearches++;
  const promise=Promise.resolve().then(run).then(value=>{
    if(settings.cacheTtlSeconds>0)cache.set(key,{expiresAt:Date.now()+settings.cacheTtlSeconds*1000,value});
    return value;
  }).finally(()=>{activeProviderSearches--;inflight.delete(key)});
  inflight.set(key,promise);
  return promise;
}

export const resetFlightControlsForTests=()=>{
  cache.clear();inflight.clear();providerCircuits.clear();activeProviderSearches=0;budgetWindowStartedAt=Date.now();providerCallsInWindow=0;
};
