import { ICategory } from './categories.interface';

const CATEGORY_IDS: Record<string, string> = {
  rent: '4f0be298-11b6-4383-9d0e-7b94a04d4d0c',
  home_improvement: '2e85bfed-3e12-4054-a349-0427cec1d887',
  electricity: '1c562531-0dc1-48b0-b7aa-739a2c598f94',
  water: '0b8cdbb6-45e4-448e-866c-e351161c8904',
  gas: 'fecd2617-b902-4686-b0b9-df4ecb44fbd1',
  internet: '3491f942-c84e-45e9-940f-d6fdcd992ade',
  generator: 'cb877430-dd04-4e95-9b76-f242088685a9',
  groceries: '766fe975-2529-46e6-9433-3e9cfae9bb30',
  eating_out: '33573929-6ede-4dee-8062-03656f376042',
  transport: '590592a3-2335-4066-b17d-7fce8d4a00db',
  fuel: '71e41b99-5916-4d1f-b814-aadab72ef5e8',
  vehicle_maintenance: '3c743c97-e932-4b92-9f41-8f60bca981e6',
  hospital: '566b86e3-ea7e-4be7-a5d2-958a0ba09fe2',
  pharmacy: '8204f239-2b31-4231-a219-706e65af3bd7',
  health_insurance: '2cced79d-0dd3-40b8-b568-545c3b6f5673',
  school_fees: '2a9a27a4-f22f-4b99-9df5-17ff3e2d5c74',
  school_supplies: 'a7c36bb1-d3cf-411c-8539-022d860c66f9',
  training: 'ee3570d2-84e6-4156-980a-f4dbc8faaafe',
  family_support: '6a6c71d1-176c-4a76-b54d-7c07ffada998',
  childcare: '65a566dd-ae00-43d0-ab5e-6a17371c45bc',
  events: 'dbfe01f9-c3bd-4dc8-b755-c17f60733c8b',
  gifts: '4147870b-fbec-4f2c-9b44-3a8d9c6ec7cb',
  traditional: '026f7e68-b1ef-44df-8753-454e3688189c',
  airtime_data: '7e010a39-b056-4f0b-87dc-8dc6447bf579',
  subscriptions: 'c90230c5-c09b-430e-9e42-44297418b169',
  personal_care: '51f36d0f-9f99-4731-b17a-783f17d315c5',
  clothing: '2211c61e-a89e-4c0a-9ab1-19c506bcf2cf',
  fitness: '6a1d010f-8996-4299-ad96-89c58f8dd86b',
  entertainment: '71bf8dca-13c5-4462-8305-bcb9348b9f41',
  travel: '275d1ae0-8cdb-47ff-b83d-eabdb31e3364',
  religious: '8a001160-0d47-40a4-ac8a-824f94c278a2',
  savings: '3ed9dc20-380a-4703-9a10-10e34771639a',
  cooperative: '8a740ffc-7850-4d50-8212-056558e5721d',
  loan_repayment: 'b7ddefb5-507e-4d99-b840-8f664744090e',
  insurance: '8cdbe6d2-c992-412d-b9a3-19fcc05812e2',
  taxes: 'cc552763-c3a4-4de1-a9b6-a1606349888d',
  business: 'aebda7d8-83db-4e34-b4e2-e0e6dbb3ac54',
  agriculture: 'ab5bf400-b861-42b2-bb60-11b5e5c840e7',
  other: '2e1d777d-b9e6-42d1-9dee-e71dfd53d90e',
};

/**
 * Canonical set of expense categories.
 * Designed for African household context — covers the full spectrum of
 * communal and personal obligations common across Nigeria, Kenya, Ghana,
 * South Africa, and the broader continent.
 *
 * `group` is a coarser analytics bucket; `slug` is the stable programmatic key.
 */
export const SEED_CATEGORIES: Omit<ICategory, 'id'>[] = [
  // ─── Housing ─────────────────────────────────────────────────────────────
  {
    slug: 'rent',
    name: 'Rent & Housing',
    description: 'Monthly/annual rent, house purchase, or mortgage payments.',
    emoji: '🏠',
    group: 'housing',
    isActive: true,
  },
  {
    slug: 'home_improvement',
    name: 'Home Repairs & Renovation',
    description: 'Fixing leaks, painting, building extensions, furniture, or any home upgrade.',
    emoji: '🔨',
    group: 'housing',
    isActive: true,
  },

  // ─── Utilities ───────────────────────────────────────────────────────────
  {
    slug: 'electricity',
    name: 'Electricity & NEPA',
    description: 'NEPA/KPLC/DISCOS bills, prepaid meter tokens, and generator fuel.',
    emoji: '💡',
    group: 'utilities',
    isActive: true,
  },
  {
    slug: 'water',
    name: 'Water & Sanitation',
    description: 'Water board bills, borehole maintenance, sachet/bottled water purchases.',
    emoji: '💧',
    group: 'utilities',
    isActive: true,
  },
  {
    slug: 'gas',
    name: 'Cooking Gas & Fuel',
    description: 'LPG cylinder refill, kerosene, and cooking fuel costs.',
    emoji: '🔥',
    group: 'utilities',
    isActive: true,
  },
  {
    slug: 'internet',
    name: 'Internet & Broadband',
    description: 'Home Wi-Fi subscription, router bills, and office broadband.',
    emoji: '📶',
    group: 'utilities',
    isActive: true,
  },
  {
    slug: 'generator',
    name: 'Generator & Power Backup',
    description: 'Generator servicing, petrol/diesel, inverter battery replacement.',
    emoji: '⚡',
    group: 'utilities',
    isActive: true,
  },

  // ─── Food ────────────────────────────────────────────────────────────────
  {
    slug: 'groceries',
    name: 'Food & Groceries',
    description: 'Market runs, supermarket shopping, cooking ingredients, and provisions.',
    emoji: '🛒',
    group: 'food',
    isActive: true,
  },
  {
    slug: 'eating_out',
    name: 'Eating Out & Takeaway',
    description: 'Restaurant meals, fast food, canteen, and food delivery orders.',
    emoji: '🍽️',
    group: 'food',
    isActive: true,
  },

  // ─── Transport ───────────────────────────────────────────────────────────
  {
    slug: 'transport',
    name: 'Transport & Commute',
    description: 'Bus fare, danfo, okada, keke, BRT, matatu, ride-hailing (Bolt/Uber).',
    emoji: '🚌',
    group: 'transport',
    isActive: true,
  },
  {
    slug: 'fuel',
    name: 'Petrol & Vehicle Fuel',
    description: 'Personal car petrol or diesel fill-ups.',
    emoji: '⛽',
    group: 'transport',
    isActive: true,
  },
  {
    slug: 'vehicle_maintenance',
    name: 'Car Maintenance & Repairs',
    description: 'Servicing, tyres, spare parts, MOT, and mechanic bills.',
    emoji: '🔧',
    group: 'transport',
    isActive: true,
  },

  // ─── Health ──────────────────────────────────────────────────────────────
  {
    slug: 'hospital',
    name: 'Hospital & Clinic',
    description: 'Consultation fees, surgery, lab tests, and admission charges.',
    emoji: '🏥',
    group: 'health',
    isActive: true,
  },
  {
    slug: 'pharmacy',
    name: 'Medicine & Pharmacy',
    description: 'Drug purchases, vitamins, supplements, and prescription medications.',
    emoji: '💊',
    group: 'health',
    isActive: true,
  },
  {
    slug: 'health_insurance',
    name: 'Health Insurance & HMO',
    description: 'NHIS, HMO premiums, and private health cover payments.',
    emoji: '🩺',
    group: 'health',
    isActive: true,
  },

  // ─── Education ───────────────────────────────────────────────────────────
  {
    slug: 'school_fees',
    name: 'School Fees & Tuition',
    description: 'Primary, secondary, and university tuition fees, levies, PTA dues, and exams.',
    emoji: '🎓',
    group: 'education',
    isActive: true,
  },
  {
    slug: 'school_supplies',
    name: 'Books, Uniforms & Supplies',
    description: 'Textbooks, stationery, uniforms, and school bags.',
    emoji: '📚',
    group: 'education',
    isActive: true,
  },
  {
    slug: 'training',
    name: 'Training & Courses',
    description: 'Professional certifications, online courses, skill acquisition, and workshops.',
    emoji: '🖥️',
    group: 'education',
    isActive: true,
  },

  // ─── Family & Social Obligations ─────────────────────────────────────────
  {
    slug: 'family_support',
    name: 'Family Support',
    description: 'Money sent to parents, siblings, or extended family for upkeep and daily needs.',
    emoji: '👨‍👩‍👧',
    group: 'family',
    isActive: true,
  },
  {
    slug: 'childcare',
    name: 'Childcare & Babysitting',
    description: 'Nanny salary, crèche fees, and day-care expenses.',
    emoji: '👶',
    group: 'family',
    isActive: true,
  },
  {
    slug: 'events',
    name: 'Events & Celebrations',
    description: 'Weddings, naming ceremonies, burials, birthday parties, and other family events.',
    emoji: '🎉',
    group: 'family',
    isActive: true,
  },
  {
    slug: 'gifts',
    name: 'Gifts & Presents',
    description: 'Gifts for family, friends, colleagues, and festive periods (Christmas, Eid).',
    emoji: '🎁',
    group: 'family',
    isActive: true,
  },
  {
    slug: 'traditional',
    name: 'Traditional & Cultural',
    description: 'Bride price, traditional ceremonies, chieftaincy dues, and cultural obligations.',
    emoji: '🌿',
    group: 'family',
    isActive: true,
  },

  // ─── Communication ───────────────────────────────────────────────────────
  {
    slug: 'airtime_data',
    name: 'Airtime & Data',
    description: 'Phone recharge cards, data bundles, and WhatsApp subscriptions.',
    emoji: '📱',
    group: 'communication',
    isActive: true,
  },
  {
    slug: 'subscriptions',
    name: 'Digital Subscriptions',
    description: 'Streaming (Netflix, Showmax, DSTV), music (Spotify, Apple Music), and software.',
    emoji: '📺',
    group: 'communication',
    isActive: true,
  },

  // ─── Personal Care ───────────────────────────────────────────────────────
  {
    slug: 'personal_care',
    name: 'Personal Care & Beauty',
    description: 'Haircuts, salon visits, barbing, toiletries, skincare, and cosmetics.',
    emoji: '💈',
    group: 'personal',
    isActive: true,
  },
  {
    slug: 'clothing',
    name: 'Clothing & Shoes',
    description: 'New clothes, shoes, accessories, and tailoring.',
    emoji: '👗',
    group: 'personal',
    isActive: true,
  },
  {
    slug: 'fitness',
    name: 'Fitness & Wellness',
    description: 'Gym membership, sports gear, yoga classes, and wellness activities.',
    emoji: '🏋️',
    group: 'personal',
    isActive: true,
  },

  // ─── Social & Recreation ─────────────────────────────────────────────────
  {
    slug: 'entertainment',
    name: 'Entertainment & Recreation',
    description: 'Cinema, concerts, gaming, amusement parks, and leisure activities.',
    emoji: '🎮',
    group: 'social',
    isActive: true,
  },
  {
    slug: 'travel',
    name: 'Travel & Holidays',
    description: 'Flights, road trips, hotels, holiday packages, and vacation expenses.',
    emoji: '✈️',
    group: 'social',
    isActive: true,
  },
  {
    slug: 'religious',
    name: 'Religious & Charity',
    description: 'Tithes, offerings, Zakat, Sadaqah, church/mosque building fund, and donations.',
    emoji: '🕌',
    group: 'social',
    isActive: true,
  },

  // ─── Finance & Savings ───────────────────────────────────────────────────
  {
    slug: 'savings',
    name: 'Savings & Investments',
    description: 'Ajo, esusu, thrift contributions, savings targets, and investment deposits.',
    emoji: '💰',
    group: 'finance',
    isActive: true,
  },
  {
    slug: 'cooperative',
    name: 'Cooperative & Association Dues',
    description: 'Cooperative society levies, union dues, street/estate association fees.',
    emoji: '🤝',
    group: 'finance',
    isActive: true,
  },
  {
    slug: 'loan_repayment',
    name: 'Loan Repayment',
    description: 'Bank loan EMIs, micro-finance repayments, and personal debt servicing.',
    emoji: '🏦',
    group: 'finance',
    isActive: true,
  },
  {
    slug: 'insurance',
    name: 'Insurance (Non-Health)',
    description: 'Car insurance, life insurance, home and property insurance premiums.',
    emoji: '🛡️',
    group: 'finance',
    isActive: true,
  },
  {
    slug: 'taxes',
    name: 'Taxes & Government Fees',
    description: 'PAYE, personal income tax, vehicle licence, passport, land use charge.',
    emoji: '🏛️',
    group: 'finance',
    isActive: true,
  },

  // ─── Business ────────────────────────────────────────────────────────────
  {
    slug: 'business',
    name: 'Business Expenses',
    description: 'Stock purchase, business supplies, logistics, and operational costs.',
    emoji: '💼',
    group: 'business',
    isActive: true,
  },
  {
    slug: 'agriculture',
    name: 'Farming & Agriculture',
    description: 'Seeds, fertilizer, farm labour, livestock, irrigation, and produce costs.',
    emoji: '🌾',
    group: 'business',
    isActive: true,
  },

  // ─── Other ───────────────────────────────────────────────────────────────
  {
    slug: 'other',
    name: 'Other',
    description: 'Anything that does not fit neatly into another category.',
    emoji: '📦',
    group: 'other',
    isActive: true,
  },
];

export const SEEDED_CATEGORIES: ICategory[] = SEED_CATEGORIES.map((c) => ({
  ...c,
  id: CATEGORY_IDS[c.slug],
}));
