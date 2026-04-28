export interface ICurrency {
  id: number;
  code: string;
  symbol: string;
}

const CURRENCIES: ICurrency[] = [
  { id: 1, code: 'NGN', symbol: '₦' },
  { id: 2, code: 'KES', symbol: 'KSh' },
  { id: 3, code: 'GHS', symbol: 'GH₵' },
  { id: 4, code: 'ZAR', symbol: 'R' },
];

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));
const CURRENCY_BY_ID = new Map(CURRENCIES.map((c) => [c.id, c]));

export function getAllCurrencies(): ICurrency[] {
  return CURRENCIES;
}

export function getCurrency(code: string): ICurrency {
  return CURRENCY_BY_CODE.get(code) ?? { id: 0, code, symbol: code };
}

export function getCurrencyById(id: number): ICurrency | undefined {
  return CURRENCY_BY_ID.get(id);
}

export function getCurrencySymbol(code: string): string {
  return getCurrency(code).symbol;
}
