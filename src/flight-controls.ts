type CacheEntry<T>={expiresAt:number;value:T};

const cache=new Map<string,CacheEntry<unknown>>();
const inflight=new Map<string,Promise<unknown>>();
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
    providerCallsPerHour:setting('PRICEMCP_FLIGHT_PROVIDER_CALLS_PER_HOUR',testing?100000:120,1,100000)
  };
};

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
  cache.clear();inflight.clear();activeProviderSearches=0;budgetWindowStartedAt=Date.now();providerCallsInWindow=0;
};
