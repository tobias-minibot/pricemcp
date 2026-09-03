import { afterEach,describe,expect,it,vi } from 'vitest';
import { openDatabase,seed } from '../src/db.js';
import { searchPrice } from '../src/price-search.js';

const db=()=>{const database=openDatabase(':memory:');seed(database);return database};

afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});

describe('flight providers',()=>{
  it('normalizes Duffel test offers and preserves baggage and fare rules',async()=>{
    vi.stubEnv('AMADEUS_API_KEY','');vi.stubEnv('AMADEUS_API_SECRET','');vi.stubEnv('DUFFEL_ACCESS_TOKEN','duffel_test_token');
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{offers:[{
      id:'off_1',live_mode:false,total_amount:'599.40',total_currency:'USD',expires_at:'2026-09-03T08:00:00Z',owner:{id:'arl_1',name:'Test Airways'},
      slices:[{segments:[{id:'seg_1'},{id:'seg_2'}]},{segments:[{id:'seg_3'}]}],passengers:[{baggages:[{type:'checked',quantity:1}]}],
      conditions:{change_before_departure:{allowed:true},refund_before_departure:{allowed:false}}
    }]}}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    const result=await searchPrice(db(),{type:'flight',origin:'WAS',destination:'BER',departure_date:'2026-09-18',return_date:'2026-09-25'});
    expect(result).toMatchObject({status:'ok',dataset:'duffel-test',synthetic:true,best_offer:{provider:{name:'Test Airways'},quote:{total_minor:59940},source:{method:'duffel_flights_test'}}});
    expect(result.best_offer?.conditions).toEqual(expect.arrayContaining(['1 total stop(s)','included: 1 checked','changes allowed before departure','non-refundable before departure']));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/air/offer_requests'),expect.objectContaining({method:'POST',headers:expect.objectContaining({'duffel-version':'v2'})}));
    const request=JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(request.data).toMatchObject({cabin_class:'economy',slices:[{origin:'WAS',destination:'BER'},{origin:'BER',destination:'WAS'}]});
  });

  it('fails closed when the only configured flight provider fails',async()=>{
    vi.stubEnv('AMADEUS_API_KEY','');vi.stubEnv('AMADEUS_API_SECRET','');vi.stubEnv('DUFFEL_ACCESS_TOKEN','duffel_test_token');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('rate limited',{status:429})));
    const result=await searchPrice(db(),{type:'flight',origin:'BOS',destination:'LHR',departure_date:'2026-10-10'});
    expect(result).toMatchObject({status:'provider_error',offers:[],synthetic:false});
    expect(result.error).toContain('Duffel Offer Requests HTTP 429');
  });
});
