
import { ReceiptItem, User } from './types';

export const MOCK_RECEIPT: ReceiptItem[] = [
  { id: '1', name: 'Margherita Pizza', price: 18.50 },
  { id: '2', name: 'Truffle Pasta', price: 24.00 },
  { id: '3', name: 'Caesar Salad', price: 12.00 },
  { id: '4', name: 'Red Wine (Glass)', price: 14.00 },
  { id: '5', name: 'Craft Beer', price: 8.50 },
  { id: '6', name: 'Espresso', price: 4.50 },
  { id: '7', name: 'Tiramisu', price: 10.00 },
  { id: '8', name: 'Garlic Bread', price: 6.50 },
  { id: '9', name: 'Calamari Fritti', price: 15.00 },
  { id: '10', name: 'Bottled Water', price: 3.50 },
];

export const INITIAL_USERS: User[] = [
  { id: 'u1', name: 'Alice', color: 'bg-blue-500' },
  { id: 'u2', name: 'Bob', color: 'bg-emerald-500' },
  { id: 'u3', name: 'Charlie', color: 'bg-purple-500' },
];

export const TIP_PRESETS = [10, 12, 15, 18, 20, 22, 25];

export const USER_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500'
];
