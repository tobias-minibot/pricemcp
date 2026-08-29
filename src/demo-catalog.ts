import type { CatalogProduct, MerchantSeed } from './types.js';

const DATASET='pricemcp-demo-v1';
const product=(id:string,brand:string,category:string,family:string,name:string,attributes:CatalogProduct['attributes'],priority:CatalogProduct['priority']='normal',aliases:string[]=[]):CatalogProduct=>({
  id,brand,category,family,name,model:typeof attributes.model==='string'?attributes.model:undefined,attributes,
  official_url:`https://example.invalid/catalog/${id}`,priority,active:true,aliases:[name,id.replace(/-/g,' '),...aliases],dataset:DATASET,synthetic:true
});

export const demoCatalog:CatalogProduct[]=[
  product('demo-apple-macbook-air-m5-13-16-512','Apple','laptop','MacBook Air','MacBook Air 13-inch M5 16GB/512GB',{chip:'M5',display_inches:13,memory_gb:16,storage_gb:512},'priority',['macbook air m5']),
  product('demo-apple-macbook-pro-m5-pro-14-24-1024','Apple','laptop','MacBook Pro','MacBook Pro 14-inch M5 Pro 24GB/1TB',{chip:'M5 PRO',display_inches:14,memory_gb:24,storage_gb:1024}),
  product('demo-apple-mac-mini-m4-16-256','Apple','desktop','Mac mini','Mac mini M4 16GB/256GB',{chip:'M4',memory_gb:16,storage_gb:256},'priority',['mac mini','mac mini m4']),
  product('demo-apple-mac-mini-m5-16-256','Apple','desktop','Mac mini','Mac mini M5 16GB/256GB',{chip:'M5',memory_gb:16,storage_gb:256},'priority',['mac mini m5']),
  product('demo-apple-mac-mini-m6-16-256','Apple','desktop','Mac mini','Mac mini M6 16GB/256GB',{chip:'M6',memory_gb:16,storage_gb:256},'priority',['mac mini m6']),
  product('demo-apple-iphone-17-pro-256','Apple','phone','iPhone 17 Pro','iPhone 17 Pro 256GB',{storage_gb:256}),
  product('demo-apple-ipad-pro-m5-11-256','Apple','tablet','iPad Pro','iPad Pro 11-inch M5 256GB',{chip:'M5',display_inches:11,storage_gb:256}),
  product('demo-apple-watch-series-11-42','Apple','wearable','Apple Watch Series 11','Apple Watch Series 11 42mm',{case_mm:42}),
  product('demo-apple-airpods-pro-3','Apple','audio','AirPods Pro 3','AirPods Pro 3',{generation:3},'priority'),
  product('demo-sony-wh-1000xm6-black','Sony','audio','WH-1000XM6','Sony WH-1000XM6 Wireless Headphones — Black',{model:'WH-1000XM6',color:'black'}),
  product('demo-nintendo-switch-2-console','Nintendo','game_console','Switch 2','Nintendo Switch 2 Console',{generation:2}),
  product('demo-amazon-kindle-paperwhite-16','Amazon','ereader','Kindle Paperwhite','Kindle Paperwhite 16GB',{storage_gb:16,ads:false}),
  product('demo-samsung-990-pro-2tb','Samsung','storage','990 PRO','Samsung 990 PRO NVMe SSD 2TB',{model:'MZ-V9P2T0B/AM',storage_gb:2048},'priority',['samsung 990 pro 2tb']),
  product('demo-tide-pods-original-42','Tide','laundry','Tide PODS','Tide PODS Original 42 Count',{quantity_count:42,unit:'pod'},'priority'),
  product('demo-bounty-select-size-6-double','Bounty','paper_goods','Select-A-Size','Bounty Select-A-Size 6 Double Rolls',{quantity_count:6,unit:'double_roll'}),
  product('demo-duracell-coppertop-aa-24','Duracell','battery','Coppertop AA','Duracell Coppertop AA 24 Pack',{quantity_count:24,unit:'battery',battery_size:'AA'}),
  product('demo-brita-standard-filter-4','Brita','water_filter','Standard Filter','Brita Standard Replacement Filters 4 Pack',{quantity_count:4,unit:'filter'}),
  product('demo-purina-pro-plan-chicken-rice-35lb','Purina','pet_food','Pro Plan Complete Essentials','Purina Pro Plan Chicken & Rice Dog Food 35 lb',{net_weight_lb:35,flavor:'chicken and rice'}),
  product('demo-huggies-little-snugglers-size4-120','Huggies','diaper','Little Snugglers','Huggies Little Snugglers Size 4 120 Count',{size:4,quantity_count:120,unit:'diaper'}),
  product('demo-dyson-v15-detect','Dyson','vacuum','V15 Detect','Dyson V15 Detect Cordless Vacuum',{model:'V15 Detect'}),
  product('demo-kitchenaid-ksm150pser','KitchenAid','mixer','Artisan','KitchenAid Artisan 5-Quart Mixer KSM150PSER',{model:'KSM150PSER',capacity_quart:5,color:'empire red'}),
  product('demo-instant-pot-duo-6qt','Instant Pot','pressure_cooker','Duo 7-in-1','Instant Pot Duo 7-in-1 6 Quart',{capacity_quart:6,functions:7}),
  product('demo-brother-hl-l2460dw','Brother','printer','HL-L2460DW','Brother HL-L2460DW Monochrome Laser Printer',{model:'HL-L2460DW'}),
  product('demo-dewalt-dcd771c2','DeWalt','power_tool','DCD771C2','DeWalt DCD771C2 Drill/Driver Kit',{model:'DCD771C2',voltage:20}),
  product('demo-lego-icons-eiffel-10307','LEGO','toy','Icons Eiffel Tower','LEGO Icons Eiffel Tower 10307',{model:'10307',piece_count:10001},'priority',['lego 10307']),
  product('demo-zelda-totk-switch-physical','Nintendo','video_game','The Legend of Zelda','The Legend of Zelda: Tears of the Kingdom — Switch Physical Edition',{platform:'Nintendo Switch',format:'physical',edition:'standard'}),
  product('demo-catan-5e-base','Catan Studio','board_game','Catan','Catan 5th Edition Base Game',{edition:5,language:'English',base_game:true}),
  product('demo-cerave-daily-lotion-16oz','CeraVe','skin_care','Daily Moisturizing Lotion','CeraVe Daily Moisturizing Lotion 16 fl oz',{volume_fl_oz:16},'priority'),
  product('demo-advil-ibuprofen-200-100','Advil','otc_medicine','Ibuprofen','Advil Ibuprofen 200mg 100 Count',{strength_mg:200,quantity_count:100,unit:'tablet'}),
  product('demo-oralb-crossaction-4','Oral-B','oral_care','CrossAction','Oral-B CrossAction Brush Heads 4 Count',{quantity_count:4,unit:'brush_head'}),
  product('demo-gillette-fusion5-8','Gillette','shaving','Fusion5','Gillette Fusion5 Refill Cartridges 8 Count',{quantity_count:8,unit:'cartridge'})
];

export const demoMerchants:MerchantSeed[]=[
  {id:'demo-brand-direct',name:'Brand Direct',verified:true,authorized:true,trust_score:1,source_type:'official',shipping_reliability:.98,marketplace_seller:false,notes:'Synthetic official-price reference.'},
  {id:'demo-northstar',name:'Northstar Retail',verified:true,authorized:true,trust_score:.96,source_type:'retailer',shipping_reliability:.95,marketplace_seller:false,notes:'Synthetic trusted national retailer.'},
  {id:'demo-club-warehouse',name:'Club Warehouse',verified:true,authorized:true,trust_score:.94,source_type:'retailer',shipping_reliability:.93,marketplace_seller:false,notes:'Synthetic membership-dependent warehouse offer.'},
  {id:'demo-marketsquare',name:'MarketSquare Seller',verified:false,authorized:false,trust_score:.55,source_type:'marketplace',shipping_reliability:.72,marketplace_seller:true,notes:'Synthetic unresolved marketplace seller.'},
  {id:'demo-outlet-depot',name:'Outlet Depot',verified:true,authorized:false,trust_score:.7,source_type:'retailer',shipping_reliability:.8,marketplace_seller:false,notes:'Synthetic unavailable/conditional outlet.'},
  {id:'demo-harbor',name:'Harbor Electronics',verified:true,authorized:true,trust_score:.9,source_type:'retailer',shipping_reliability:.9,marketplace_seller:false,notes:'Synthetic stale-offer scenario.'}
];

export const demoOfficialPrices:Record<string,number>={
  'demo-apple-macbook-air-m5-13-16-512':129900,'demo-apple-macbook-pro-m5-pro-14-24-1024':229900,'demo-apple-mac-mini-m4-16-256':59900,'demo-apple-mac-mini-m5-16-256':64900,'demo-apple-mac-mini-m6-16-256':69900,'demo-apple-iphone-17-pro-256':109900,'demo-apple-ipad-pro-m5-11-256':99900,'demo-apple-watch-series-11-42':42900,'demo-apple-airpods-pro-3':24900,
  'demo-sony-wh-1000xm6-black':44999,'demo-nintendo-switch-2-console':44999,'demo-amazon-kindle-paperwhite-16':15999,'demo-samsung-990-pro-2tb':19999,
  'demo-tide-pods-original-42':1399,'demo-bounty-select-size-6-double':2299,'demo-duracell-coppertop-aa-24':1899,'demo-brita-standard-filter-4':2499,'demo-purina-pro-plan-chicken-rice-35lb':7499,'demo-huggies-little-snugglers-size4-120':4499,
  'demo-dyson-v15-detect':74999,'demo-kitchenaid-ksm150pser':44999,'demo-instant-pot-duo-6qt':9999,'demo-brother-hl-l2460dw':17999,'demo-dewalt-dcd771c2':12999,
  'demo-lego-icons-eiffel-10307':62999,'demo-zelda-totk-switch-physical':6999,'demo-catan-5e-base':5499,'demo-cerave-daily-lotion-16oz':1599,'demo-advil-ibuprofen-200-100':1199,'demo-oralb-crossaction-4':3499,'demo-gillette-fusion5-8':4299
};

export const demoDataset=DATASET;
