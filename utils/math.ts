
import { RoundingMode } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const precise = (val: number): number => {
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

export const calculateTotals = (
  subtotal: number,
  taxRate: number,
  tipRate: number,
  tipOnPreTax: boolean,
  taxOnPostTip: boolean,
  roundingMode: RoundingMode,
  taxAmount: number | null = null,
  isCashDiscountEnabled: boolean = false,
  cashDiscountRate: number = 0
) => {
  const cashDiscountAmount = isCashDiscountEnabled ? precise(subtotal * (cashDiscountRate / 100)) : 0;
  const effectiveSubtotal = subtotal - cashDiscountAmount;

  // 1. Initial Tax calculation
  let tax = taxAmount !== null ? precise(taxAmount) : precise(effectiveSubtotal * (taxRate / 100));

  // 2. Tip calculation
  const tipBase = tipOnPreTax ? effectiveSubtotal : (effectiveSubtotal + tax);
  let tip = precise(tipBase * (tipRate / 100));

  // 3. Optional: Tax on Post-Tip (Service Charge taxation)
  if (taxOnPostTip) {
    tax = taxAmount !== null ? precise(taxAmount) : precise((effectiveSubtotal + tip) * (taxRate / 100));
  }
  
  let grandTotal = precise(effectiveSubtotal + tax + tip);

  // 4. Apply Rounding
  if (roundingMode !== 'none') {
    let rounded: number;
    switch (roundingMode) {
      case 'up':
        rounded = Math.ceil(grandTotal);
        break;
      case 'down':
        rounded = Math.floor(grandTotal);
        break;
      case 'nearest':
      default:
        rounded = Math.round(grandTotal);
        break;
    }
    const diff = rounded - grandTotal;
    tip = precise(tip + diff);
    grandTotal = rounded;
  }

  return { subtotal, tax, tip, cashDiscountAmount, grandTotal };
};
