import type { Db } from './db.js';
import { getOffers, searchProducts } from './db.js';

export type ProductPriceSubject = { type:'product'; query:string };
export type FlightPriceSubject = {
  type:'flight'; origin:string; destination:string; departure_date:string;
  return_date?:string; cabin?:'economy'|'premium_economy'|'business'|'first'; adults?:number;
};
export type IncompletePriceSubject = { type:'incomplete'; intent:'flight'; query:string; missing:string[] };
export type PriceSearchSubject = ProductPriceSubject | FlightPriceSubject | IncompletePriceSubject;

export type FlightOfferDetails = {
  comparison_key:string;
  cabin:string;
  fare_brands:string[];
  baggage:string[];
  base_minor:number|null;
  base_currency:string|null;
  tax_minor:number|null;
  tax_currency:string|null;
  emissions_kg:number|null;
  total_duration_minutes:number|null;
  change_before_departure:{allowed:boolean|null;penalty_minor:number|null;currency:string|null};
  refund_before_departure:{allowed:boolean|null;penalty_minor:number|null;currency:string|null};
  slices:Array<{
    origin:{iata_code:string|null;name:string|null;city_name:string|null};
    destination:{iata_code:string|null;name:string|null;city_name:string|null};
    duration_minutes:number|null;
    stops:number;
    fare_brand_name:string|null;
    segments:Array<{
      departing_at:string|null;arriving_at:string|null;duration_minutes:number|null;
      origin:{iata_code:string|null;name:string|null;terminal:string|null};
      destination:{iata_code:string|null;name:string|null;terminal:string|null};
      marketing_carrier:string|null;operating_carrier:string|null;flight_number:string|null;
      aircraft:string|null;cabin:string|null;fare_basis_code:string|null;
    }>;
  }>;
};

export type UniversalOffer = {
  offer_id:string;
  dataset:string;
  synthetic:boolean;
  provider:{ provider_id:string; name:string; trusted:boolean; trust_score:number|null };
  quote:{ amount_minor:number; currency:string; shipping_minor:number|null; total_minor:number; basis:string };
  availability:'available'|'unavailable'|'unknown';
  conditions:string[];
  match:{ canonical:boolean; confidence:number|null };
  source:{ method:string; source_product_id:string|null; url:string|null };
  observed_at:string;
  freshness:{ age_seconds:number; status:'fresh'|'recent'|'aging'|'stale' };
  expires_at:string|null;
  flight?:FlightOfferDetails;
};

export type PriceSearchResult = {
  status:'ok'|'no_match'|'not_configured'|'provider_error';
  subject:Record<string,unknown>;
  best_offer:UniversalOffer|null;
  offers:UniversalOffer[];
  ranking:{ policy:string; explanation:string[] };
  dataset:string;
  synthetic:boolean;
  error?:string;
};

type FlightProviderResult = {provider:string;offers:UniversalOffer[];dataset:string;synthetic:boolean};

export const isIsoDate=(value:string):boolean=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value};

const cityCode=(value:string):string=>{
  const normalized=value.trim().toLowerCase();
  if(['washington','washington dc','dc','was','dca','iad'].includes(normalized))return 'WAS';
  if(['berlin','ber'].includes(normalized))return 'BER';
  return value.trim().toUpperCase().slice(0,3);
};

const safeSourceUrl=(value:unknown):string|null=>{
  if(typeof value!=='string'||!value)return null;
  try{const url=new URL(value);return url.protocol==='https:'?url.toString():null}catch{return null}
};

const amountMinor=(value:unknown):number|null=>{const parsed=Number(value);return Number.isFinite(parsed)?Math.round(parsed*100):null};
const durationMinutes=(value:unknown):number|null=>{if(typeof value!=='string')return null;const match=value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?$/);if(!match)return null;return Number(match[1]||0)*1440+Number(match[2]||0)*60+Number(match[3]||0)};
const airport=(value:any)=>({iata_code:typeof value?.iata_code==='string'?value.iata_code:null,name:typeof value?.name==='string'?value.name:null,city_name:typeof value?.city_name==='string'?value.city_name:null});
const fareRule=(value:any)=>({allowed:typeof value?.allowed==='boolean'?value.allowed:null,penalty_minor:amountMinor(value?.penalty_amount),currency:typeof value?.penalty_currency==='string'?value.penalty_currency:null});
const fareRuleLabel=(name:string,rule:ReturnType<typeof fareRule>):string=>{
  if(rule.allowed===false)return name==='changes'?'changes not allowed before departure':'non-refundable before departure';
  if(rule.allowed!==true)return `${name.slice(0,-1)} rules unknown`;
  const penalty=rule.penalty_minor===null?'penalty unknown':rule.penalty_minor===0?'no stated penalty':`${rule.currency||''} ${(rule.penalty_minor/100).toFixed(2)} penalty`.trim();
  return `${name} allowed before departure; ${penalty}`;
};

export function parseNaturalPriceQuery(query:string,_now=new Date()):PriceSearchSubject{
  const dates=query.match(/\b20\d{2}-\d{2}-\d{2}\b/g)||[];
  if(/\b(flight|fly|flying|fare)\b/i.test(query)||(/\b(washington|dc|was|dca|iad)\b/i.test(query)&&/\b(berlin|ber)\b/i.test(query))){
    const place='washington(?:\\s+dc)?|dc|was|dca|iad|berlin|ber|[a-z]{3}';
    const route=query.match(new RegExp(`(?:^|[^a-z])(?:\\b(?:flight|fly|flying|fare)\\b\\s*)?(?:from\\s+)?(${place})(?![a-z])\\s+(?:to|→|-)\\s+(${place})(?![a-z])`,'i'));
    const origin=route?.[1]?cityCode(route[1]):undefined,destination=route?.[2]?cityCode(route[2]):undefined;
    const invalidDate=dates.some(date=>!isIsoDate(date));
    const missing=[...(!origin||!destination?['origin/destination']:[]),...(dates.length<1?['departure_date']:[]),...(invalidDate?['valid flight date']:[]),...(dates.length>2?['unambiguous flight dates']:[])];
    if(missing.length)return{type:'incomplete',intent:'flight',query,missing};
    return {type:'flight',origin:origin!,destination:destination!,departure_date:dates[0]!,...(dates[1]?{return_date:dates[1]}:{}),cabin:'economy',adults:1};
  }
  return {type:'product',query:query.trim()};
}

const productOffer=(offer:any):UniversalOffer=>({
  offer_id:`product:${offer.merchant_id}:${offer.source_product_id}`,
  dataset:offer.dataset??'live',synthetic:!!offer.synthetic,
  provider:{provider_id:offer.merchant_id,name:offer.merchant_name,trusted:!!offer.trusted,trust_score:Number(offer.trust_score)},
  quote:{amount_minor:offer.price_minor,currency:offer.currency,shipping_minor:offer.shipping_minor,total_minor:offer.total_minor,basis:offer.shipping_minor===null?'item price; shipping unknown':'delivered before destination tax'},
  availability:offer.available?'available':'unavailable',conditions:[offer.condition,offer.membership_required?'membership required':'no membership required'],
  match:{canonical:true,confidence:Number.isFinite(Number(offer.match_confidence))?Number(offer.match_confidence):null},
  source:{method:offer.source_method,source_product_id:offer.source_product_id??null,url:safeSourceUrl(offer.url)},observed_at:offer.observed_at,
  freshness:{age_seconds:offer.age_seconds,status:offer.freshness_status},expires_at:null
});

const demoFlightOffers=(subject:FlightPriceSubject):UniversalOffer[]=>{
  if(subject.origin!=='WAS'||subject.destination!=='BER'||subject.departure_date!=='2026-09-18'||subject.return_date!=='2026-09-25'||(subject.cabin||'economy')!=='economy'||(subject.adults||1)!==1)return[];
  const observed=new Date().toISOString();
  return [
    ['united','United',61200,'1 stop · economy · round trip'],
    ['icelandair','Icelandair',64100,'1 stop · economy · round trip'],
    ['lufthansa','Lufthansa',68800,'nonstop · economy · round trip']
  ].map(([id,name,amount,condition])=>({
    offer_id:`flight-demo:${id}:${subject.origin}-${subject.destination}`,
    dataset:'pricemcp-demo-v1',synthetic:true,
    provider:{provider_id:String(id),name:String(name),trusted:true,trust_score:null},
    quote:{amount_minor:Number(amount),currency:'USD',shipping_minor:0,total_minor:Number(amount),basis:'illustrative round-trip fare; taxes included; bags and seat fees may vary'},
    availability:'available' as const,conditions:[String(condition),'1 adult','demo fixture — not bookable'],
    match:{canonical:true,confidence:1},source:{method:'synthetic_flight_fixture',source_product_id:null,url:null},observed_at:observed,freshness:{age_seconds:0,status:'fresh' as const},expires_at:null
  }));
};

async function amadeusFlightOffers(subject:FlightPriceSubject):Promise<FlightProviderResult>{
  const key=process.env.AMADEUS_API_KEY||'',secret=process.env.AMADEUS_API_SECRET||'';
  if(!key||!secret)throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET are not configured');
  const production=process.env.AMADEUS_ENV==='production';
  const host=production?'https://api.amadeus.com':'https://test.api.amadeus.com';
  const tokenResponse=await fetch(`${host}/v1/security/oauth2/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:key,client_secret:secret}),signal:AbortSignal.timeout(15_000)});
  if(!tokenResponse.ok)throw new Error(`Amadeus OAuth HTTP ${tokenResponse.status}`);
  const token=String((await tokenResponse.json() as any).access_token||'');if(!token)throw new Error('Amadeus OAuth response contained no access token');
  const params=new URLSearchParams({originLocationCode:subject.origin,destinationLocationCode:subject.destination,departureDate:subject.departure_date,adults:String(subject.adults||1),travelClass:(subject.cabin||'economy').toUpperCase(),currencyCode:'USD',max:'5'});
  if(subject.return_date)params.set('returnDate',subject.return_date);
  const response=await fetch(`${host}/v2/shopping/flight-offers?${params}`,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(25_000)});
  if(!response.ok)throw new Error(`Amadeus Flight Offers HTTP ${response.status}`);
  const payload=await response.json() as any,carriers=payload?.dictionaries?.carriers||{};
  const offers=(Array.isArray(payload?.data)?payload.data:[]).map((item:any,index:number):UniversalOffer=>{
    const code=String(item.validatingAirlineCodes?.[0]||item.itineraries?.[0]?.segments?.[0]?.carrierCode||'airline');
    const amount=Math.round(Number(item.price?.grandTotal||item.price?.total||0)*100);
    const segments=(item.itineraries||[]).flatMap((itinerary:any)=>itinerary.segments||[]);
    return {offer_id:`amadeus:${item.id||index}`,dataset:production?'amadeus-production':'amadeus-test',synthetic:!production,provider:{provider_id:code,name:carriers[code]||code,trusted:true,trust_score:null},quote:{amount_minor:amount,currency:String(item.price?.currency||'USD'),shipping_minor:0,total_minor:amount,basis:'flight offer total; ancillary fees may vary'},availability:item.numberOfBookableSeats===0?'unavailable':'available',conditions:[`${Math.max(0,segments.length-(item.itineraries||[]).length)} total stop(s)`,String(subject.cabin||'economy'),`${subject.adults||1} adult(s)`],match:{canonical:true,confidence:1},source:{method:production?'amadeus_flight_offers_live':'amadeus_flight_offers_test',source_product_id:String(item.id||index),url:safeSourceUrl('https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search')},observed_at:new Date().toISOString(),freshness:{age_seconds:0,status:'fresh'},expires_at:item.lastTicketingDate?`${item.lastTicketingDate}T23:59:59Z`:null};
  }).filter((offer:UniversalOffer)=>offer.quote.total_minor>0&&offer.availability==='available').sort((a:UniversalOffer,b:UniversalOffer)=>a.quote.total_minor-b.quote.total_minor);
  return {provider:'Amadeus',offers,dataset:production?'amadeus-production':'amadeus-test',synthetic:!production};
}

async function duffelFlightOffers(subject:FlightPriceSubject):Promise<FlightProviderResult>{
  const token=process.env.DUFFEL_ACCESS_TOKEN||'';
  if(!token)throw new Error('DUFFEL_ACCESS_TOKEN is not configured');
  const environment=process.env.DUFFEL_ENV||'test';
  if(environment!=='test'&&environment!=='production')throw new Error('DUFFEL_ENV must be test or production');
  const expectedPrefix=environment==='production'?'duffel_live_':'duffel_test_';
  if(!token.startsWith(expectedPrefix))throw new Error(`DUFFEL_ACCESS_TOKEN does not match DUFFEL_ENV=${environment}; refusing the request`);
  const slices=[{origin:subject.origin,destination:subject.destination,departure_date:subject.departure_date}];
  if(subject.return_date)slices.push({origin:subject.destination,destination:subject.origin,departure_date:subject.return_date});
  const response=await fetch('https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=10000',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','duffel-version':'v2',accept:'application/json'},body:JSON.stringify({data:{slices,passengers:Array.from({length:subject.adults||1},()=>({type:'adult'})),cabin_class:subject.cabin||'economy'}}),signal:AbortSignal.timeout(25_000)});
  if(!response.ok)throw new Error(`Duffel Offer Requests HTTP ${response.status}`);
  const payload=await response.json() as any,items=Array.isArray(payload?.data?.offers)?payload.data.offers:[];
  const offers=items.map((item:any,index:number):UniversalOffer=>{
    const amount=Math.round(Number(item.total_amount||0)*100),owner=item.owner||{},rawSlices=Array.isArray(item.slices)?item.slices:[];
    const changeRule=fareRule(item.conditions?.change_before_departure),refundRule=fareRule(item.conditions?.refund_before_departure);
    const normalizedSlices:FlightOfferDetails['slices']=rawSlices.map((slice:any)=>{
      const rawSegments=Array.isArray(slice.segments)?slice.segments:[];
      return{origin:airport(slice.origin),destination:airport(slice.destination),duration_minutes:durationMinutes(slice.duration),stops:Math.max(0,rawSegments.length-1+rawSegments.reduce((total:number,segment:any)=>total+(Array.isArray(segment.stops)?segment.stops.length:0),0)),fare_brand_name:typeof slice.fare_brand_name==='string'?slice.fare_brand_name:null,segments:rawSegments.map((segment:any)=>{const passenger=Array.isArray(segment.passengers)?segment.passengers[0]:null;return{departing_at:typeof segment.departing_at==='string'?segment.departing_at:null,arriving_at:typeof segment.arriving_at==='string'?segment.arriving_at:null,duration_minutes:durationMinutes(segment.duration),origin:{...airport(segment.origin),terminal:typeof segment.origin_terminal==='string'?segment.origin_terminal:null},destination:{...airport(segment.destination),terminal:typeof segment.destination_terminal==='string'?segment.destination_terminal:null},marketing_carrier:typeof segment.marketing_carrier?.name==='string'?segment.marketing_carrier.name:null,operating_carrier:typeof segment.operating_carrier?.name==='string'?segment.operating_carrier.name:null,flight_number:[segment.marketing_carrier?.iata_code,segment.marketing_carrier_flight_number].filter(Boolean).join(' ')||null,aircraft:typeof segment.aircraft?.name==='string'?segment.aircraft.name:null,cabin:typeof passenger?.cabin_class_marketing_name==='string'?passenger.cabin_class_marketing_name:typeof passenger?.cabin_class==='string'?passenger.cabin_class:null,fare_basis_code:typeof passenger?.fare_basis_code==='string'?passenger.fare_basis_code:null}})};
    });
    const segments=rawSlices.flatMap((slice:any)=>Array.isArray(slice.segments)?slice.segments:[]),stops=normalizedSlices.reduce((total,slice)=>total+slice.stops,0);
    const bags:string[]=[...new Set<string>(segments.flatMap((segment:any)=>Array.isArray(segment.passengers)?segment.passengers:[]).flatMap((passenger:any)=>Array.isArray(passenger.baggages)?passenger.baggages:[]).map((bag:any)=>`${bag.quantity||1} ${String(bag.type||'bag').replace(/_/g,' ')}`))];
    const fareBrands=[...new Set(normalizedSlices.map(slice=>slice.fare_brand_name).filter((value):value is string=>Boolean(value)))];
    const comparisonKey=[String(owner.id||''),...rawSlices.map((slice:any)=>String(slice.comparison_key||'')),fareBrands.join('/')].filter(Boolean).join('|')||segments.map((segment:any)=>[segment.marketing_carrier?.iata_code,segment.marketing_carrier_flight_number,segment.departing_at].filter(Boolean).join(':')).join('|')||String(item.id||index);
    const totalDuration=normalizedSlices.every(slice=>slice.duration_minutes!==null)?normalizedSlices.reduce((total,slice)=>total+(slice.duration_minutes||0),0):null;
    const conditions=[`${stops} total stop(s)`,fareBrands.length?fareBrands.join(' / '):String(subject.cabin||'economy'),`${subject.adults||1} adult(s)`,...(bags.length?[`included: ${bags.join(', ')}`]:['baggage inclusion unknown']),fareRuleLabel('changes',changeRule),fareRuleLabel('refunds',refundRule)];
    const flight:FlightOfferDetails={comparison_key:comparisonKey,cabin:String(subject.cabin||'economy'),fare_brands:fareBrands,baggage:bags,base_minor:amountMinor(item.base_amount),base_currency:typeof item.base_currency==='string'?item.base_currency:null,tax_minor:amountMinor(item.tax_amount),tax_currency:typeof item.tax_currency==='string'?item.tax_currency:null,emissions_kg:Number.isFinite(Number(item.total_emissions_kg))?Number(item.total_emissions_kg):null,total_duration_minutes:totalDuration,change_before_departure:changeRule,refund_before_departure:refundRule,slices:normalizedSlices};
    return {offer_id:`duffel:${item.id||index}`,dataset:item.live_mode===true?'duffel-live':'duffel-test',synthetic:item.live_mode!==true,provider:{provider_id:String(owner.id||'duffel'),name:String(owner.name||'Duffel airline offer'),trusted:true,trust_score:null},quote:{amount_minor:amount,currency:String(item.total_currency||'USD'),shipping_minor:0,total_minor:amount,basis:'Duffel offer total including provider-reported base fare and taxes; optional services may cost extra'},availability:'available',conditions,match:{canonical:true,confidence:1},source:{method:item.live_mode===true?'duffel_flights_live':'duffel_flights_test',source_product_id:String(item.id||index),url:safeSourceUrl('https://duffel.com/docs/api/v2/offer-requests')},observed_at:new Date().toISOString(),freshness:{age_seconds:0,status:'fresh'},expires_at:typeof item.expires_at==='string'?item.expires_at:null,flight};
  }).filter((offer:UniversalOffer)=>offer.quote.total_minor>0).sort((a:UniversalOffer,b:UniversalOffer)=>a.quote.total_minor-b.quote.total_minor).slice(0,50);
  const synthetic=offers.every((offer:UniversalOffer)=>offer.synthetic);
  if(environment==='test'&&!synthetic)throw new Error('Duffel returned live inventory while DUFFEL_ENV=test; refusing the result');
  return{provider:'Duffel',offers,dataset:synthetic?'duffel-test':'duffel-live',synthetic};
}

async function configuredFlightOffers(subject:FlightPriceSubject):Promise<{offers:UniversalOffer[];dataset:string;synthetic:boolean;errors:string[]}|null>{
  const providers:Array<{name:string;run:()=>Promise<FlightProviderResult>}>=[];
  if(process.env.AMADEUS_API_KEY&&process.env.AMADEUS_API_SECRET)providers.push({name:'Amadeus',run:()=>amadeusFlightOffers(subject)});
  if(process.env.DUFFEL_ACCESS_TOKEN)providers.push({name:'Duffel',run:()=>duffelFlightOffers(subject)});
  if(!providers.length)return null;
  const settled=await Promise.allSettled(providers.map(provider=>provider.run())),results:FlightProviderResult[]=[],errors:string[]=[];
  settled.forEach((item,index)=>item.status==='fulfilled'?results.push(item.value):errors.push(`${providers[index]!.name}: ${item.reason instanceof Error?item.reason.message:String(item.reason)}`));
  if(!results.length)throw new Error(errors.join('; '));
  const all=results.flatMap(result=>result.offers),hasLive=all.some(offer=>!offer.synthetic),eligible=hasLive?all.filter(offer=>!offer.synthetic):all;
  eligible.sort((a,b)=>a.quote.total_minor-b.quote.total_minor);
  return{offers:eligible,dataset:results.length>1?'multi-source':results[0]!.dataset,synthetic:!hasLive,errors};
}

export const flightProviderInternals={duffelFlightOffers,amadeusFlightOffers,configuredFlightOffers};

export async function searchPrice(db:Db,subject:PriceSearchSubject,options:{allowDemoFlights?:boolean;forceDemoFlights?:boolean;maxAgeHours?:number}={}):Promise<PriceSearchResult>{
  if(subject.type==='incomplete')return{status:'no_match',subject,best_offer:null,offers:[],ranking:{policy:'complete itinerary required',explanation:[`Missing ${subject.missing.join(' and ')}; PriceMCP did not invent an itinerary.`]},dataset:process.env.PRICEMCP_DATASET||'live',synthetic:process.env.PRICEMCP_DATASET==='pricemcp-demo-v1'};
  if(subject.type==='product'){
    const candidates=searchProducts(db,subject.query,5),product=candidates[0],second=candidates[1];
    const ambiguous=!product||Number(product.score)<1||second&&Number(second.score)>=Number(product.score);
    if(ambiguous)return{status:'no_match',subject:{type:'product',query:subject.query,candidates:candidates.slice(0,3).map(({id,name,score})=>({product_id:id,name,match_score:score}))},best_offer:null,offers:[],ranking:{policy:'unique canonical product identity first',explanation:['The query did not identify one unique canonical variant; no nearby or arbitrary variant was substituted.']},dataset:process.env.PRICEMCP_DATASET||'live',synthetic:process.env.PRICEMCP_DATASET==='pricemcp-demo-v1'};
    const offers=getOffers(db,product.id,options.maxAgeHours??6).filter(offer=>offer.available&&!offer.membership_required).map(productOffer);
    const trusted=offers.filter(offer=>offer.provider.trusted),best=trusted[0]||offers[0]||null;
    return{status:best?'ok':'no_match',subject:{type:'product',query:subject.query,product_id:product.id,name:product.name,attributes:product.attributes},best_offer:best,offers,ranking:{policy:'exact match, then trusted fresh unconditional total',explanation:[best?`${best.provider.name} is the highest-ranked fresh exact-match offer.`:'The product matched, but no fresh eligible offer is available.','Sponsored placement and affiliate economics are not ranking inputs.']},dataset:product.dataset||'live',synthetic:!!product.synthetic};
  }
  const normalized={...subject,origin:cityCode(subject.origin),destination:cityCode(subject.destination),cabin:subject.cabin||'economy',adults:subject.adults||1};
  try{
    const configured=options.forceDemoFlights?null:await configuredFlightOffers(normalized);
    if(!configured&&!options.allowDemoFlights)return{status:'not_configured',subject:normalized,best_offer:null,offers:[],ranking:{policy:'lowest comparable eligible fare',explanation:['No flight provider is configured; PriceMCP did not invent a quote.']},dataset:'live',synthetic:false,error:'Amadeus or Duffel credentials are not configured'};
    const result=configured||{offers:demoFlightOffers(normalized),dataset:'pricemcp-demo-v1',synthetic:true,errors:[]};
    return{status:result.offers.length?'ok':'no_match',subject:normalized,best_offer:result.offers[0]||null,offers:result.offers,ranking:{policy:'lowest comparable available total',explanation:[result.offers.length?'Fares are ordered by observed total, with data source and conditions preserved.':'No fare matched the requested itinerary and demo/provider scope.',...(result.errors.length?[`Some configured providers failed and were excluded: ${result.errors.join('; ')}`]:[]),'No sponsored or affiliate ranking input is used.']},dataset:result.dataset,synthetic:result.synthetic};
  }catch(error){return{status:'provider_error',subject:normalized,best_offer:null,offers:[],ranking:{policy:'fail closed',explanation:['The provider failed, so PriceMCP emitted no fare.']},dataset:'live',synthetic:false,error:error instanceof Error?error.message:String(error)};}
}
