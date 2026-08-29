import type { Db } from './db.js';
import { getOffers, searchProducts } from './db.js';

export type ProductPriceSubject = { type:'product'; query:string };
export type FlightPriceSubject = {
  type:'flight'; origin:string; destination:string; departure_date:string;
  return_date?:string; cabin?:'economy'|'premium_economy'|'business'|'first'; adults?:number;
};
export type IncompletePriceSubject = { type:'incomplete'; intent:'flight'; query:string; missing:string[] };
export type PriceSearchSubject = ProductPriceSubject | FlightPriceSubject | IncompletePriceSubject;

export type UniversalOffer = {
  offer_id:string;
  provider:{ provider_id:string; name:string; trusted:boolean; trust_score:number|null };
  quote:{ amount_minor:number; currency:string; shipping_minor:number|null; total_minor:number; basis:string };
  availability:'available'|'unavailable'|'unknown';
  conditions:string[];
  source:{ method:string; url:string|null };
  observed_at:string;
  expires_at:string|null;
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

export const isIsoDate=(value:string):boolean=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const parsed=new Date(`${value}T00:00:00Z`);return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value};

const cityCode=(value:string):string=>{
  const normalized=value.trim().toLowerCase();
  if(['washington','washington dc','dc','was','dca','iad'].includes(normalized))return 'WAS';
  if(['berlin','ber'].includes(normalized))return 'BER';
  return value.trim().toUpperCase().slice(0,3);
};

export function parseNaturalPriceQuery(query:string,_now=new Date()):PriceSearchSubject{
  const dates=query.match(/\b20\d{2}-\d{2}-\d{2}\b/g)||[];
  if(/\b(flight|fly|flying|fare)\b/i.test(query)||(/\b(washington|dc|was|dca|iad)\b/i.test(query)&&/\b(berlin|ber)\b/i.test(query))){
    const place='washington(?:\\s+dc)?|dc|was|dca|iad|berlin|ber|[a-z]{3}';
    const route=query.match(new RegExp(`(?:\\b(?:flight|fly|flying|fare)\\b\\s*)?(?:from\\s+)?(${place})\\s+(?:to|→|-)\\s+(${place})\\b`,'i'));
    const origin=route?.[1]?cityCode(route[1]):undefined,destination=route?.[2]?cityCode(route[2]):undefined;
    const invalidDate=dates.some(date=>!isIsoDate(date));
    const missing=[...(!origin||!destination?['origin/destination']:[]),...(dates.length<1?['departure_date']:[]),...(invalidDate?['valid flight date']:[])];
    if(missing.length)return{type:'incomplete',intent:'flight',query,missing};
    return {type:'flight',origin:origin!,destination:destination!,departure_date:dates[0]!,...(dates[1]?{return_date:dates[1]}:{}),cabin:'economy',adults:1};
  }
  return {type:'product',query:query.trim()};
}

const productOffer=(offer:any):UniversalOffer=>({
  offer_id:`product:${offer.merchant_id}:${offer.source_product_id}`,
  provider:{provider_id:offer.merchant_id,name:offer.merchant_name,trusted:!!offer.trusted,trust_score:Number(offer.trust_score)},
  quote:{amount_minor:offer.price_minor,currency:offer.currency,shipping_minor:offer.shipping_minor,total_minor:offer.total_minor,basis:offer.shipping_minor===null?'item price; shipping unknown':'delivered before destination tax'},
  availability:offer.available?'available':'unavailable',conditions:[offer.condition,offer.membership_required?'membership required':'no membership required'],
  source:{method:offer.source_method,url:offer.url},observed_at:offer.observed_at,expires_at:null
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
    provider:{provider_id:String(id),name:String(name),trusted:true,trust_score:null},
    quote:{amount_minor:Number(amount),currency:'USD',shipping_minor:0,total_minor:Number(amount),basis:'illustrative round-trip fare; taxes included; bags and seat fees may vary'},
    availability:'available' as const,conditions:[String(condition),'1 adult','demo fixture — not bookable'],
    source:{method:'synthetic_flight_fixture',url:null},observed_at:observed,expires_at:null
  }));
};

async function amadeusFlightOffers(subject:FlightPriceSubject):Promise<{offers:UniversalOffer[];dataset:string;synthetic:boolean}>{
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
    return {offer_id:`amadeus:${item.id||index}`,provider:{provider_id:code,name:carriers[code]||code,trusted:true,trust_score:null},quote:{amount_minor:amount,currency:String(item.price?.currency||'USD'),shipping_minor:0,total_minor:amount,basis:'flight offer total; ancillary fees may vary'},availability:item.numberOfBookableSeats===0?'unavailable':'available',conditions:[`${Math.max(0,segments.length-(item.itineraries||[]).length)} total stop(s)`,String(subject.cabin||'economy'),`${subject.adults||1} adult(s)`],source:{method:production?'amadeus_flight_offers_live':'amadeus_flight_offers_test',url:'https://developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search'},observed_at:new Date().toISOString(),expires_at:item.lastTicketingDate?`${item.lastTicketingDate}T23:59:59Z`:null};
  }).filter((offer:UniversalOffer)=>offer.quote.total_minor>0&&offer.availability==='available').sort((a:UniversalOffer,b:UniversalOffer)=>a.quote.total_minor-b.quote.total_minor);
  return {offers,dataset:production?'amadeus-production':'amadeus-test',synthetic:!production};
}

export async function searchPrice(db:Db,subject:PriceSearchSubject,options:{allowDemoFlights?:boolean;maxAgeHours?:number}={}):Promise<PriceSearchResult>{
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
    const hasCredentials=Boolean(process.env.AMADEUS_API_KEY&&process.env.AMADEUS_API_SECRET);
    if(!hasCredentials&&!options.allowDemoFlights)return{status:'not_configured',subject:normalized,best_offer:null,offers:[],ranking:{policy:'lowest comparable eligible fare',explanation:['No flight provider is configured; PriceMCP did not invent a quote.']},dataset:'live',synthetic:false,error:'Amadeus credentials are not configured'};
    const result=hasCredentials?await amadeusFlightOffers(normalized):{offers:demoFlightOffers(normalized),dataset:'pricemcp-demo-v1',synthetic:true};
    return{status:result.offers.length?'ok':'no_match',subject:normalized,best_offer:result.offers[0]||null,offers:result.offers,ranking:{policy:'lowest comparable available total',explanation:[result.offers.length?'Fares are ordered by observed total, with data source and conditions preserved.':'No fare matched the requested itinerary and demo/provider scope.','No sponsored or affiliate ranking input is used.']},dataset:result.dataset,synthetic:result.synthetic};
  }catch(error){return{status:'provider_error',subject:normalized,best_offer:null,offers:[],ranking:{policy:'fail closed',explanation:['The provider failed, so PriceMCP emitted no fare.']},dataset:'live',synthetic:false,error:error instanceof Error?error.message:String(error)};}
}
