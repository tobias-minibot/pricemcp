import { flightProviderInternals } from '../src/price-search.js';

const [origin='JFK',destination='LHR',departureDate,returnDate]=process.argv.slice(2);
const token=process.env.DUFFEL_ACCESS_TOKEN||'';

if(process.env.DUFFEL_ENV&&process.env.DUFFEL_ENV!=='test')throw new Error('Sandbox verification requires DUFFEL_ENV=test');
if(!token)throw new Error('Add DUFFEL_ACCESS_TOKEN=duffel_test_... to the ignored local .env file');
if(!token.startsWith('duffel_test_'))throw new Error('Sandbox verification refuses non-test Duffel tokens');
if(!/^[A-Z]{3}$/.test(origin)||!/^[A-Z]{3}$/.test(destination))throw new Error('Origin and destination must be three-letter uppercase IATA codes');
if(!departureDate||!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)||returnDate&&!/^\d{4}-\d{2}-\d{2}$/.test(returnDate))throw new Error('Usage: npm run verify:duffel -- JFK LHR YYYY-MM-DD [YYYY-MM-DD]');

const result=await flightProviderInternals.duffelFlightOffers({
  type:'flight',origin,destination,departure_date:departureDate,
  ...(returnDate?{return_date:returnDate}:{}),cabin:'economy',adults:1
});

if(!result.synthetic||result.dataset!=='duffel-test')throw new Error('Expected Duffel sandbox results only');

console.log(JSON.stringify({
  status:'ok',provider:result.provider,dataset:result.dataset,synthetic:result.synthetic,
  itinerary:{origin,destination,departure_date:departureDate,...(returnDate?{return_date:returnDate}:{})},
  offer_count:result.offers.length,
  offers:result.offers.slice(0,5).map(offer=>({
    airline:offer.provider.name,total_minor:offer.quote.total_minor,
    currency:offer.quote.currency,conditions:offer.conditions,expires_at:offer.expires_at
  }))
},null,2));
