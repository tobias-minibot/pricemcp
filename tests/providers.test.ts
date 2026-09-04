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
      base_amount:'500.00',base_currency:'USD',tax_amount:'99.40',tax_currency:'USD',total_emissions_kg:'321',
      slices:[{comparison_key:'outbound',fare_brand_name:'Basic',duration:'PT9H15M',origin:{iata_code:'IAD',name:'Dulles',city_name:'Washington'},destination:{iata_code:'BER',name:'Brandenburg',city_name:'Berlin'},segments:[{id:'seg_1',departing_at:'2026-09-18T18:00:00',arriving_at:'2026-09-19T06:00:00',duration:'PT7H',origin:{iata_code:'IAD',name:'Dulles'},origin_terminal:'1',destination:{iata_code:'LHR',name:'Heathrow'},destination_terminal:'5',marketing_carrier:{name:'Test Airways',iata_code:'TA'},operating_carrier:{name:'Test Airways'},marketing_carrier_flight_number:'101',aircraft:{name:'A350'},passengers:[{baggages:[{type:'checked',quantity:1},{type:'carry_on',quantity:1}],cabin_class_marketing_name:'Economy',fare_basis_code:'YTEST'}]},{id:'seg_2',stops:[]}]},{comparison_key:'return',fare_brand_name:'Basic',duration:'PT8H45M',segments:[{id:'seg_3'}]}],
      conditions:{change_before_departure:{allowed:true,penalty_amount:'40.00',penalty_currency:'USD'},refund_before_departure:{allowed:false,penalty_amount:null,penalty_currency:null}}
    }]}}),{status:200,headers:{'content-type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    const result=await searchPrice(db(),{type:'flight',origin:'WAS',destination:'BER',departure_date:'2026-09-18',return_date:'2026-09-25'});
    expect(result).toMatchObject({status:'ok',dataset:'duffel-test',synthetic:true,best_offer:{provider:{name:'Test Airways'},quote:{total_minor:59940},source:{method:'duffel_flights_test'}}});
    expect(result.best_offer?.conditions).toEqual(expect.arrayContaining(['1 total stop(s)','included: 1 checked, 1 carry on','changes allowed before departure; USD 40.00 penalty','non-refundable before departure']));
    expect(result.best_offer?.flight).toMatchObject({comparison_key:'arl_1|outbound|return|Basic',fare_brands:['Basic'],baggage:['1 checked','1 carry on'],base_minor:50000,base_currency:'USD',tax_minor:9940,tax_currency:'USD',emissions_kg:321,total_duration_minutes:1080,change_before_departure:{allowed:true,penalty_minor:4000,currency:'USD'}});
    expect(result.best_offer?.flight?.slices).toEqual(expect.arrayContaining([expect.objectContaining({origin:expect.objectContaining({iata_code:'IAD'}),destination:expect.objectContaining({iata_code:'BER'}),duration_minutes:555,stops:1,segments:expect.arrayContaining([expect.objectContaining({flight_number:'TA 101',aircraft:'A350',cabin:'Economy',fare_basis_code:'YTEST'})])})]));
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

  it('refuses a live Duffel token unless production is explicitly enabled',async()=>{
    vi.stubEnv('AMADEUS_API_KEY','');vi.stubEnv('AMADEUS_API_SECRET','');vi.stubEnv('DUFFEL_ACCESS_TOKEN','duffel_live_must_not_be_used');vi.stubEnv('DUFFEL_ENV','test');
    const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
    const result=await searchPrice(db(),{type:'flight',origin:'BOS',destination:'LHR',departure_date:'2026-10-10'});
    expect(result).toMatchObject({status:'provider_error',offers:[],synthetic:false});
    expect(result.error).toContain('does not match DUFFEL_ENV=test');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
