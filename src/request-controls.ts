type Window={startedAt:number;count:number};

export function createFixedWindowLimiter(max:number,windowMs=60_000){
  const windows=new Map<string,Window>();
  return(key:string,now=Date.now())=>{
    let current=windows.get(key);
    if(!current||now-current.startedAt>=windowMs){current={startedAt:now,count:0};windows.set(key,current)}
    current.count++;
    if(windows.size>10_000)for(const [candidate,value] of windows)if(now-value.startedAt>=windowMs)windows.delete(candidate);
    const retryAfterSeconds=Math.max(1,Math.ceil((current.startedAt+windowMs-now)/1000));
    return{allowed:current.count<=max,limit:max,remaining:Math.max(0,max-current.count),retryAfterSeconds};
  };
}
