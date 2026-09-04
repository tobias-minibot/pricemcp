import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { controlledFlightProvider, controlledFlightSearch, resetFlightControlsForTests } from '../src/flight-controls.js';
import { openDatabase, seed } from '../src/db.js';
import { buildApp } from '../src/server.js';

beforeEach(()=>resetFlightControlsForTests());
afterEach(()=>{vi.unstubAllEnvs();resetFlightControlsForTests()});

describe('flight provider request controls',()=>{
  it('caches identical searches and does not spend a second provider call',async()=>{
    vi.stubEnv('PRICEMCP_FLIGHT_CACHE_TTL_SECONDS','60');
    vi.stubEnv('PRICEMCP_FLIGHT_PROVIDER_CALLS_PER_HOUR','1');
    let calls=0;
    expect(await controlledFlightSearch('same',1,async()=>++calls)).toBe(1);
    expect(await controlledFlightSearch('same',1,async()=>++calls)).toBe(1);
    expect(calls).toBe(1);
    await expect(controlledFlightSearch('different',1,async()=>++calls)).rejects.toThrow(/budget exhausted/i);
  });

  it('coalesces simultaneous identical searches before applying concurrency limits',async()=>{
    vi.stubEnv('PRICEMCP_FLIGHT_CACHE_TTL_SECONDS','0');
    vi.stubEnv('PRICEMCP_FLIGHT_MAX_CONCURRENT_SEARCHES','1');
    let release!:()=>void,calls=0;
    const gate=new Promise<void>(resolve=>{release=resolve});
    const first=controlledFlightSearch('same',1,async()=>{calls++;await gate;return 'ok'});
    const duplicate=controlledFlightSearch('same',1,async()=>{calls++;return 'wrong'});
    await expect(controlledFlightSearch('different',1,async()=>'wrong')).rejects.toThrow(/concurrency limit/i);
    release();
    await expect(Promise.all([first,duplicate])).resolves.toEqual(['ok','ok']);
    expect(calls).toBe(1);
  });

  it('opens a provider circuit after consecutive failures and recovers after cooldown',async()=>{
    vi.stubEnv('PRICEMCP_FLIGHT_PROVIDER_FAILURE_THRESHOLD','2');
    vi.stubEnv('PRICEMCP_FLIGHT_PROVIDER_CIRCUIT_COOLDOWN_SECONDS','10');
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-04T16:00:00Z'));
    let calls=0;
    const fail=()=>controlledFlightProvider('Duffel',async()=>{calls++;throw new Error('upstream unavailable')});
    await expect(fail()).rejects.toThrow('upstream unavailable');
    await expect(fail()).rejects.toThrow('upstream unavailable');
    await expect(controlledFlightProvider('Duffel',async()=>{calls++;return 'wrong'})).rejects.toThrow(/circuit open.*retry after 10 seconds/i);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(controlledFlightProvider('Duffel',async()=>{calls++;return 'recovered'})).resolves.toBe('recovered');
    expect(calls).toBe(3);
    vi.useRealTimers();
  });

  it('tracks provider circuits independently',async()=>{
    vi.stubEnv('PRICEMCP_FLIGHT_PROVIDER_FAILURE_THRESHOLD','1');
    await expect(controlledFlightProvider('Amadeus',async()=>{throw new Error('failed')})).rejects.toThrow('failed');
    await expect(controlledFlightProvider('Duffel',async()=>'ok')).resolves.toBe('ok');
  });

  it('reopens immediately when the first call after cooldown still fails',async()=>{
    vi.stubEnv('PRICEMCP_FLIGHT_PROVIDER_FAILURE_THRESHOLD','2');
    vi.stubEnv('PRICEMCP_FLIGHT_PROVIDER_CIRCUIT_COOLDOWN_SECONDS','10');
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-04T16:00:00Z'));
    let calls=0;
    const fail=()=>controlledFlightProvider('Duffel',async()=>{calls++;throw new Error('still unavailable')});
    await expect(fail()).rejects.toThrow('still unavailable');
    await expect(fail()).rejects.toThrow('still unavailable');
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(fail()).rejects.toThrow('still unavailable');
    await expect(fail()).rejects.toThrow(/circuit open/i);
    expect(calls).toBe(3);
    vi.useRealTimers();
  });

  it('rate limits public search bridges without blocking health checks',async()=>{
    vi.stubEnv('PRICEMCP_PUBLIC_SEARCH_RATE_LIMIT_PER_MINUTE','2');
    const db=openDatabase(':memory:');seed(db);const app=buildApp(db,{readOnly:true});
    const payload={type:'product',query:'MacBook Air M5 13 16GB 512GB'};
    expect((await app.inject({method:'POST',url:'/v1/search-price',payload})).statusCode).toBe(200);
    expect((await app.inject({method:'POST',url:'/v1/search-price',payload})).statusCode).toBe(200);
    const limited=await app.inject({method:'POST',url:'/v1/search-price',payload});
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({status:'rate_limited'});
    expect((await app.inject({url:'/internal/health'})).statusCode).toBe(200);
    await app.close();
  });
});
