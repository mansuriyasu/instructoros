export const ONTARIO_HST_RATE = 0.13;
export const DEFAULT_TAX_LABEL = 'HST';

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTaxAmount(amount: number, rate = ONTARIO_HST_RATE) {
  return roundCurrency(Math.max(0, amount) * Math.max(0, rate));
}

export function formatTaxRate(rate = ONTARIO_HST_RATE) {
  return `${roundCurrency(rate * 100).toString().replace(/\.0$/, '')}%`;
}

export function formatTaxLabel(label = DEFAULT_TAX_LABEL, rate = ONTARIO_HST_RATE) {
  return `${label || DEFAULT_TAX_LABEL} (${formatTaxRate(rate)})`;
}
