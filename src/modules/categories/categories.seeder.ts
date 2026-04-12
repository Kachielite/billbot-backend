import { v4 as uuidv4 } from 'uuid';
import { ICategory } from './categories.interface';

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

/** Attach stable UUIDs so the seeder is idempotent on re-run. */
export const SEEDED_CATEGORIES: ICategory[] = SEED_CATEGORIES.map((c) => ({
  ...c,
  id: uuidv4(),
}));
