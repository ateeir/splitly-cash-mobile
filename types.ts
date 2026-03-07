
export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
}

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface Assignment {
  userId: string;
  amount: number;
}

export type AssignmentsMap = Record<string, Assignment[]>;

export type RoundingMode = 'none' | 'nearest' | 'up' | 'down';

export interface SplitSettings {
  taxRate: number;
  taxAmount: number | null;
  tipRate: number;
  tipOnPreTax: boolean;
  taxOnPostTip: boolean;
  roundingMode: RoundingMode;
  splitOverheadEqually: boolean;
  cashDiscountRate: number;
  isCashDiscountEnabled: boolean;
}

export interface Totals {
  subtotal: number;
  tax: number;
  tip: number;
  cashDiscountAmount: number;
  grandTotal: number;
}
