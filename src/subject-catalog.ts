export type CatalogField = {
  name: string;
  required: boolean;
  description: string;
};

export type SubjectContract = {
  type: 'product'|'flight'|'stay'|'rental_car'|'activity'|'transfer';
  label: string;
  state: 'live'|'provider_ready'|'contract_ready';
  comparison_unit: string;
  required_fields: CatalogField[];
  material_terms: string[];
  source_plan: string[];
  consumer_action: 'provider_handoff'|'evidence_only';
};

export const subjectCatalog: SubjectContract[] = [
  {
    type:'product', label:'Retail products', state:'live', comparison_unit:'Exact canonical variant, condition, and seller of record',
    required_fields:[
      {name:'query',required:true,description:'Exact product model and material variant attributes'}
    ],
    material_terms:['item price','shipping','destination tax basis','membership dependency','stock','condition','returns','freshness'],
    source_plan:['manufacturer direct','authorized retailer API','verified first-party retailer PDP'], consumer_action:'provider_handoff'
  },
  {
    type:'flight', label:'Flights', state:'provider_ready', comparison_unit:'Complete itinerary for the same travelers and cabin',
    required_fields:[
      {name:'origin',required:true,description:'IATA city or airport code'},
      {name:'destination',required:true,description:'IATA city or airport code'},
      {name:'departure_date',required:true,description:'YYYY-MM-DD'},
      {name:'return_date',required:false,description:'YYYY-MM-DD for a round trip'},
      {name:'cabin',required:false,description:'economy, premium_economy, business, or first'},
      {name:'adults',required:false,description:'1–9 adult travelers'}
    ],
    material_terms:['complete fare total','taxes','bags','seats','stops','duration','refundability','changeability','expiry'],
    source_plan:['Amadeus Flight Offers Search','Duffel Flights API'], consumer_action:'provider_handoff'
  },
  {
    type:'stay', label:'Stays', state:'contract_ready', comparison_unit:'Same property, room, occupancy, dates, and payment basis',
    required_fields:[
      {name:'destination',required:true,description:'City, region, landmark, or property'},
      {name:'check_in',required:true,description:'YYYY-MM-DD'},
      {name:'check_out',required:true,description:'YYYY-MM-DD'},
      {name:'adults',required:true,description:'Adult guests'},
      {name:'rooms',required:true,description:'Rooms required'}
    ],
    material_terms:['room and bed type','meal plan','taxes','property fees','deposit','pay-now or pay-later','cancellation window'],
    source_plan:['Booking.com Demand API','Expedia Rapid Lodging'], consumer_action:'provider_handoff'
  },
  {
    type:'rental_car', label:'Rental cars', state:'contract_ready', comparison_unit:'Same stations, dates, driver, and vehicle class',
    required_fields:[
      {name:'pickup',required:true,description:'Pickup station or location'},
      {name:'dropoff',required:true,description:'Drop-off station or location'},
      {name:'pickup_at',required:true,description:'Local ISO date and time'},
      {name:'dropoff_at',required:true,description:'Local ISO date and time'},
      {name:'driver_age',required:true,description:'Primary driver age'}
    ],
    material_terms:['vehicle class','mileage','fuel policy','insurance basis','deposit','young-driver fee','cancellation'],
    source_plan:['approved car-rental partner API'], consumer_action:'provider_handoff'
  },
  {
    type:'activity', label:'Activities', state:'contract_ready', comparison_unit:'Same activity, session, participants, and inclusions',
    required_fields:[
      {name:'destination',required:true,description:'Destination or attraction'},
      {name:'date',required:true,description:'YYYY-MM-DD'},
      {name:'participants',required:true,description:'Participant ages and counts'}
    ],
    material_terms:['session time','inclusions','ticket delivery','accessibility','cancellation','fees'],
    source_plan:['approved activities inventory API'], consumer_action:'provider_handoff'
  },
  {
    type:'transfer', label:'Transfers', state:'contract_ready', comparison_unit:'Same route, time, party, luggage, and vehicle basis',
    required_fields:[
      {name:'origin',required:true,description:'Pickup point'},
      {name:'destination',required:true,description:'Drop-off point'},
      {name:'pickup_at',required:true,description:'Local ISO date and time'},
      {name:'travelers',required:true,description:'Traveler count'}
    ],
    material_terms:['private or shared','vehicle class','luggage','waiting time','meet-and-greet','cancellation','fees'],
    source_plan:['approved transfer inventory API'], consumer_action:'provider_handoff'
  }
];

export const catalogSummary = () => ({
  version:'2026-09-03',
  ranking_boundary:'Advertising, affiliate payout, and sponsored placement are never ranking inputs.',
  transaction_boundary:'PriceMCP compares evidence and may hand off to a provider; it does not claim in-app booking without provider, payment, support, and cancellation controls.',
  contracts:subjectCatalog
});
