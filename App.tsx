
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ReceiptItem, User, Assignment, AssignmentsMap, SplitSettings, Totals, RoundingMode } from './types';
import { MOCK_RECEIPT, INITIAL_USERS, USER_COLORS } from './constants';
import { calculateTotals, formatCurrency, precise } from './utils/math';
import ReceiptItemCard from './components/ReceiptItemCard';
import AssignmentModal from './components/AssignmentModal';
import SummaryFooter from './components/SummaryFooter';
import {
  Plus, Users, Receipt,
  Settings, Image as ImageIcon,
  Trash2, Loader2, Equal, ArrowUp, ArrowDown, Minus,
  LayoutGrid, Info, Calculator, TableProperties,
  UserCheck, Banknote, UserPlus, Users2, Sun, Moon,
  Eraser, Edit3, Percent, DollarSign, Key, Eye, EyeOff, X
} from 'lucide-react';

const App: React.FC = () => {
  const [items, setItems] = useState<ReceiptItem[]>(MOCK_RECEIPT); 
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [assignments, setAssignments] = useState<AssignmentsMap>({});
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'calculator' | 'comparison'>('calculator');
  const [guestTab, setGuestTab] = useState<'members' | 'matrix'>('members');
  const [roundingTarget, setRoundingTarget] = useState<'bill' | 'individual'>('bill');
  const [guestCount, setGuestCount] = useState<number>(1);
  const [isManualInputVisible, setIsManualInputVisible] = useState(false);
  const [manualSubtotal, setManualSubtotal] = useState('');
  const [taxInputMode, setTaxInputMode] = useState<'percent' | 'amount'>('percent');
  const [discountInputMode, setDiscountInputMode] = useState<'percent' | 'amount'>('percent');
  
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
             (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [settings, setSettings] = useState<SplitSettings>({
    taxRate: 8.875, 
    taxAmount: null,
    tipRate: 20,    
    tipOnPreTax: true,
    taxOnPostTip: false, 
    roundingMode: 'none',
    splitOverheadEqually: true,
    cashDiscountRate: 0,
    discountAmount: null,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('gemini_api_key') || '';
    }
    return '';
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Logic: Calculate Totals
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
  
  const totals = useMemo(() => calculateTotals(
    subtotal, 
    settings.taxRate, 
    settings.tipRate, 
    settings.tipOnPreTax, 
    settings.taxOnPostTip,
    settings.roundingMode,
    settings.taxAmount,
    settings.cashDiscountRate,
    settings.discountAmount
  ), [subtotal, settings.taxRate, settings.tipRate, settings.tipOnPreTax, settings.taxOnPostTip, settings.roundingMode, settings.taxAmount, settings.cashDiscountRate, settings.discountAmount]);

  const comparisonData = useMemo(() => {
    const tipPresets = [15, 18, 20, 22, 25];
    return tipPresets.map(p => ({
      percentage: p,
      totals: calculateTotals(
        subtotal, 
        settings.taxRate, 
        p, 
        settings.tipOnPreTax, 
        settings.taxOnPostTip, 
        settings.roundingMode, 
        settings.taxAmount,
        settings.cashDiscountRate,
        settings.discountAmount
      )
    }));
  }, [subtotal, settings.taxRate, settings.tipOnPreTax, settings.taxOnPostTip, settings.roundingMode, settings.taxAmount, settings.cashDiscountRate, settings.discountAmount]);

  const getBreakdown = (currentTotals: Totals, currentSettings: SplitSettings, target: 'bill' | 'individual') => {
    const userIds = users.map(u => u.id);
    const breakdown: Record<string, { base: number; tax: number; tip: number; total: number }> = {};
    userIds.forEach(id => breakdown[id] = { base: 0, tax: 0, tip: 0, total: 0 });

    const discountFactor = (1 - currentTotals.cashDiscountAmount / (subtotal || 1));
    
    // 1. Calculate Base for each user
    (Object.entries(assignments) as [string, Assignment[]][]).forEach(([itemId, itemAssignments]) => {
      itemAssignments.forEach(a => {
        if (breakdown[a.userId]) breakdown[a.userId].base += a.amount * discountFactor;
      });
    });

    const unassignedItems = items.filter(item => !assignments[item.id] || assignments[item.id].length === 0);
    if (unassignedItems.length > 0 && users.length > 0) {
      const sharedTotal = unassignedItems.reduce((s, i) => s + i.price, 0);
      const perUser = (sharedTotal * discountFactor) / users.length;
      userIds.forEach(id => breakdown[id].base += perUser);
    }

    // Ensure sum of base matches subtotal - discount
    const targetTotalBase = precise(subtotal - currentTotals.cashDiscountAmount);
    let currentSumBase = 0;
    userIds.forEach((id, index) => {
      if (index === userIds.length - 1) {
        breakdown[id].base = precise(targetTotalBase - currentSumBase);
      } else {
        breakdown[id].base = precise(breakdown[id].base);
        currentSumBase = precise(currentSumBase + breakdown[id].base);
      }
    });

    // 2. Calculate Tax and Tip
    if (userIds.length > 0) {
      let currentSumTax = 0;
      let currentSumTip = 0;

      userIds.forEach((id, index) => {
        const b = breakdown[id];
        if (index === userIds.length - 1) {
          b.tax = precise(currentTotals.tax - currentSumTax);
          b.tip = precise(currentTotals.tip - currentSumTip);
        } else {
          if (currentSettings.splitOverheadEqually) {
            b.tax = precise(currentTotals.tax / userIds.length);
            b.tip = precise(currentTotals.tip / userIds.length);
          } else if (targetTotalBase > 0) {
            b.tax = precise((b.base / targetTotalBase) * currentTotals.tax);
            b.tip = precise((b.base / targetTotalBase) * currentTotals.tip);
          }
          currentSumTax = precise(currentSumTax + b.tax);
          currentSumTip = precise(currentSumTip + b.tip);
        }
        b.total = precise(b.base + b.tax + b.tip);

        // Individual Rounding (Applied after splitting, may result in sum != total)
        if (target === 'individual' && currentSettings.roundingMode !== 'none') {
          let rounded: number;
          switch (currentSettings.roundingMode) {
            case 'up': rounded = Math.ceil(b.total); break;
            case 'down': rounded = Math.floor(b.total); break;
            default: rounded = Math.round(b.total); break;
          }
          const diff = rounded - b.total;
          b.tip = precise(b.tip + diff);
          b.total = rounded;
        }
      });
    }

    return breakdown;
  };

  const userBreakdown = useMemo(() => getBreakdown(totals, settings, roundingTarget), [items, users, assignments, totals, settings, roundingTarget]);

  const roundingModes: RoundingMode[] = ['none', 'nearest', 'up', 'down'];
  const roundingMatrixData = useMemo(() => {
    return roundingModes.map(mode => {
      const t = calculateTotals(
        subtotal, 
        settings.taxRate, 
        settings.tipRate, 
        settings.tipOnPreTax, 
        settings.taxOnPostTip, 
        mode, 
        settings.taxAmount,
        settings.isCashDiscountEnabled,
        settings.cashDiscountRate
      );
      const b = getBreakdown(t, { ...settings, roundingMode: mode }, roundingTarget);
      const sumTotal = Object.values(b).reduce((acc, guest) => acc + guest.total, 0);
      return { mode, breakdown: b, sumTotal };
    });
  }, [subtotal, settings, users, assignments, roundingTarget]);

  const saveApiKey = () => {
    const key = apiKeyInput.trim();
    if (key) {
      setGeminiApiKey(key);
      localStorage.setItem('gemini_api_key', key);
      setShowApiKeyModal(false);
      setApiKeyInput('');
      setShowApiKey(false);
    }
  };

  const clearApiKey = () => {
    setGeminiApiKey('');
    localStorage.removeItem('gemini_api_key');
    setApiKeyInput('');
    setShowApiKey(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log('[SCAN] Starting scan...');
    console.log('[SCAN] File:', { name: file.name, type: file.type, size: file.size });

    if (!geminiApiKey) {
      console.log('[SCAN] No API key set, showing modal');
      setShowApiKeyModal(true);
      if (e.target) e.target.value = '';
      return;
    }

    setIsScanning(true);
    try {
      console.log('[SCAN] Reading file as base64...');
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      console.log('[SCAN] Base64 ready, length:', base64Data.length);

      console.log('[SCAN] Calling /api/scan-receipt...');
      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType: file.type || 'image/jpeg',
          apiKey: geminiApiKey,
        }),
      });
      console.log('[SCAN] Response status:', res.status);

      let data;
      const responseText = await res.text();
      console.log('[SCAN] Raw response:', responseText);
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error('[SCAN] Failed to parse response as JSON:', responseText);
        throw new Error('Server returned an invalid response. Check the console for details.');
      }
      console.log('[SCAN] Parsed data:', JSON.stringify(data, null, 2));

      if (!res.ok) {
        if (res.status === 401) {
          alert(data.error || 'Invalid API key. Please check your Gemini API key in settings.');
          setShowApiKeyModal(true);
          return;
        }
        throw new Error(data.error || 'Failed to scan receipt');
      }

      console.log('[SCAN] Items count:', data.items?.length ?? 0, '| Tax:', data.tax, '| Subtotal:', data.subtotal);

      if (data.items && data.items.length > 0) {
        const newItems = data.items.map((item: any, idx: number) => ({
          id: `ai-${Date.now()}-${idx}`,
          name: item.name || 'Unknown Item',
          price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0
        }));

        console.log('[SCAN] Setting', newItems.length, 'items');
        setItems(newItems);

        if (data.subtotal > 0 && data.tax >= 0) {
          const calculatedRate = (data.tax / data.subtotal) * 100;
          console.log('[SCAN] Tax rate calculated:', calculatedRate);
          setSettings(prev => ({
            ...prev,
            taxRate: precise(calculatedRate) || 8.875,
            taxAmount: null
          }));
        }

        setAssignments({});
        setSelectedItemIds(new Set());
      } else {
        console.log('[SCAN] No items found in response');
        alert('No items found on the receipt. Try a clearer photo.');
      }
    } catch (error: any) {
      console.error("[SCAN] Scan failed:", error);
      alert(error.message || "Failed to scan receipt. Please try again or enter items manually.");
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const updateItem = (id: string, updates: Partial<ReceiptItem>) => setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
  const saveAssignments = (itemId: string, itemAssignments: Assignment[]) => { setAssignments(prev => ({ ...prev, [itemId]: itemAssignments })); setSelectedItemIds(new Set()); };
  const addUser = () => setUsers([...users, { id: `u${Date.now()}`, name: `Guest ${users.length + 1}`, color: USER_COLORS[users.length % USER_COLORS.length] }]);
  const updateUserName = (id: string, newName: string) => setUsers(users.map(u => u.id === id ? { ...u, name: newName } : u));
  const removeUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
    const next = { ...assignments };
    Object.keys(next).forEach(k => next[k] = next[k].filter(a => a.userId !== id));
    setAssignments(next);
  };

  const handleClearAll = () => {
    if (confirm('Clear all items and assignments?')) {
      setItems([]);
      setAssignments({});
      setSelectedItemIds(new Set());
    }
  };

  const handleApplyManualSubtotal = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseFloat(manualSubtotal);
    if (!isNaN(val) && val > 0) {
      setItems([{ id: `manual-${Date.now()}`, name: 'Manual Entry', price: val }]);
      setAssignments({});
      setSelectedItemIds(new Set());
      setManualSubtotal('');
      setIsManualInputVisible(false);
    }
  };

  return (
    <div className={`min-h-screen pb-32 transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          <h2 className="text-white font-black mt-4 uppercase tracking-widest text-sm">Processing...</h2>
        </div>
      )}

      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-500" />
                <h3 className={`font-black text-sm uppercase tracking-wider ${darkMode ? 'text-white' : 'text-slate-800'}`}>Gemini API Key</h3>
              </div>
              <button onClick={() => { setShowApiKeyModal(false); setApiKeyInput(''); setShowApiKey(false); }} className={`p-1 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {geminiApiKey ? (
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${darkMode ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  <Key className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-xs font-bold flex-1">Key set: ...{geminiApiKey.slice(-6)}</span>
                  <button onClick={clearApiKey} className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-colors ${darkMode ? 'bg-rose-900/30 text-rose-400 hover:bg-rose-900/50' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>Remove</button>
                </div>
              ) : null}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  {geminiApiKey ? 'Replace API Key' : 'Enter API Key'}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className={`w-full border rounded-lg px-3 pr-10 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
                    onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
                    autoFocus
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className={`text-[9px] mt-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Google AI Studio</a>. Your key is stored locally in your browser.
                </p>
              </div>
              <button
                onClick={saveApiKey}
                disabled={!apiKeyInput.trim()}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={`sticky top-0 z-30 px-4 sm:px-6 py-1.5 flex items-center justify-between border-b shadow-sm backdrop-blur-md transition-colors ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1 rounded-lg shadow-lg shadow-blue-500/20"><Receipt className="text-white w-4 h-4" /></div>
          <div><h1 className={`text-sm sm:text-base font-black transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>SPLITLY</h1><p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0">NYC BILL SPLITTER</p></div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => { setShowApiKeyModal(true); setApiKeyInput(''); }}
            className={`p-1.5 rounded-lg transition-all border relative ${geminiApiKey ? (darkMode ? 'bg-slate-800 border-emerald-700 text-emerald-400 hover:bg-slate-700' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100') : (darkMode ? 'bg-slate-800 border-amber-700 text-amber-400 hover:bg-slate-700' : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100')}`}
            title={geminiApiKey ? 'API key configured' : 'Set Gemini API key'}
          >
            <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {!geminiApiKey && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 rounded-lg transition-all border ${darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md text-[10px] sm:text-xs">
            <ImageIcon className="w-3 h-3" /> <span className="hidden sm:inline">Scan Receipt</span><span className="sm:hidden">Scan</span>
          </button>
          <button onClick={addUser} className={`p-1.5 rounded-lg transition-all border ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 p-2 sm:p-4">
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className={`text-lg sm:text-xl font-black flex items-center gap-2 transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}><Calculator className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" /> Bill Items</h2>
            <div className="flex gap-1">
              <button 
                onClick={() => setIsManualInputVisible(!isManualInputVisible)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all border text-[9px] uppercase tracking-wider ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <Edit3 className="w-2.5 h-2.5" />
                <span>Manual</span>
              </button>
              <button 
                onClick={handleClearAll}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold transition-all border text-[9px] uppercase tracking-wider ${darkMode ? 'bg-rose-900/20 border-rose-800 text-rose-400 hover:bg-rose-900/40' : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'}`}
              >
                <Eraser className="w-2.5 h-2.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {isManualInputVisible && (
            <form onSubmit={handleApplyManualSubtotal} className={`p-3 sm:p-4 rounded-xl border transition-all animate-in slide-in-from-top-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <div className="flex-1 w-full">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Enter Bill Subtotal</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      autoFocus
                      type="number" 
                      step="0.01" 
                      value={manualSubtotal} 
                      onChange={(e) => setManualSubtotal(e.target.value)}
                      placeholder="0.00" 
                      className={`w-full border-none rounded-lg pl-8 pr-4 py-2 text-base sm:text-lg font-black focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`}
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button type="submit" className="flex-1 sm:flex-none px-5 py-2 bg-blue-600 text-white rounded-lg font-black text-xs sm:text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">APPLY</button>
                  <button type="button" onClick={() => setIsManualInputVisible(false)} className={`flex-1 sm:flex-none px-5 py-2 rounded-lg font-black text-xs sm:text-sm transition-all ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>CANCEL</button>
                </div>
              </div>
            </form>
          )}

          {items.length === 0 ? (
            <div className={`py-12 sm:py-16 text-center border-2 border-dashed rounded-2xl sm:rounded-3xl transition-colors ${darkMode ? 'border-slate-800 bg-slate-800/20' : 'border-slate-200 bg-white'}`}>
              <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 transition-colors ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                <Receipt className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
              </div>
              <h3 className={`text-base sm:text-lg font-bold mb-1 sm:mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>No items yet</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto px-4">Scan a receipt or enter a manual subtotal to start splitting your bill.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
              {items.map(item => (
                <ReceiptItemCard key={item.id} item={item} assignments={assignments[item.id] || []} users={users} isSelected={selectedItemIds.has(item.id)} onUpdate={updateItem} onSelect={(id) => { const next = new Set(selectedItemIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedItemIds(next); }} onAssignClick={(id) => { setSelectedItemIds(new Set([id])); setIsModalOpen(true); }} darkMode={darkMode} />
              ))}
            </div>
          )}

          {selectedItemIds.size > 0 && (
            <div className="sticky bottom-20 left-0 right-0 z-20 flex justify-center animate-in slide-in-from-bottom-4">
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black shadow-xl shadow-blue-500/30 uppercase tracking-widest text-[9px] sm:text-xs flex items-center gap-2 active:scale-95 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Assign {selectedItemIds.size} Selected
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-3 sm:space-y-4">
          <section className={`rounded-xl sm:rounded-2xl shadow-sm border overflow-hidden transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className={`flex border-b transition-colors ${darkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <button onClick={() => setActiveTab('calculator')} className={`flex-1 py-2 flex items-center justify-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${activeTab === 'calculator' ? (darkMode ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'bg-white text-blue-600 border-b-2 border-blue-600') : 'text-slate-400'}`}><Settings className="w-3 h-3" /> Calculations</button>
              <button onClick={() => setActiveTab('comparison')} className={`flex-1 py-2 flex items-center justify-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${activeTab === 'comparison' ? (darkMode ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'bg-white text-blue-600 border-b-2 border-blue-600') : 'text-slate-400'}`}><LayoutGrid className="w-3 h-3" /> Tip Matrix</button>
            </div>
            <div className="p-3 sm:p-4">
              {activeTab === 'calculator' ? (
                <div className="space-y-4 sm:space-y-5 animate-in fade-in">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Tax</label>
                        <div className={`flex p-0.5 rounded-md transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                           <button onClick={() => setTaxInputMode('percent')} className={`p-0.5 rounded transition-all ${taxInputMode === 'percent' ? (darkMode ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-xs') : 'text-slate-500'}`}><Percent className="w-2 h-2" /></button>
                           <button onClick={() => setTaxInputMode('amount')} className={`p-0.5 rounded transition-all ${taxInputMode === 'amount' ? (darkMode ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 shadow-xs') : 'text-slate-500'}`}><DollarSign className="w-2 h-2" /></button>
                        </div>
                      </div>
                      {taxInputMode === 'percent' ? (
                        <div className="relative">
                          <input type="number" step="0.001" value={settings.taxRate} onChange={(e) => setSettings({...settings, taxRate: parseFloat(e.target.value) || 0, taxAmount: null})} className={`w-full border-none rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} />
                          <button onClick={() => setSettings({...settings, taxRate: 8.875, taxAmount: null})} className={`absolute right-1 top-1/2 -translate-y-1/2 text-[7px] font-black px-1 py-0.5 rounded transition-colors ${darkMode ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>NYC</button>
                        </div>
                      ) : (
                        <div className="relative">
                           <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">$</span>
                           <input type="number" step="0.01" value={settings.taxAmount || ''} onChange={(e) => setSettings({...settings, taxAmount: parseFloat(e.target.value) || 0})} placeholder="0.00" className={`w-full border-none rounded-lg pl-4 pr-2 py-1.5 text-xs sm:text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Discount</label>
                        <div className={`flex p-0.5 rounded-md transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                           <button onClick={() => setDiscountInputMode('percent')} className={`p-0.5 rounded transition-all ${discountInputMode === 'percent' ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 shadow-xs') : 'text-slate-500'}`}><Percent className="w-2 h-2" /></button>
                           <button onClick={() => setDiscountInputMode('amount')} className={`p-0.5 rounded transition-all ${discountInputMode === 'amount' ? (darkMode ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600 shadow-xs') : 'text-slate-500'}`}><DollarSign className="w-2 h-2" /></button>
                        </div>
                      </div>
                      {discountInputMode === 'percent' ? (
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.1" 
                            value={settings.cashDiscountRate} 
                            onChange={(e) => setSettings({...settings, cashDiscountRate: parseFloat(e.target.value) || 0, discountAmount: null})} 
                            className={`w-full border-none rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold focus:ring-1 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} 
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">%</span>
                        </div>
                      ) : (
                        <div className="relative">
                           <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">$</span>
                           <input 
                             type="number" 
                             step="0.01" 
                             value={settings.discountAmount || ''} 
                             onChange={(e) => setSettings({...settings, discountAmount: parseFloat(e.target.value) || 0})} 
                             placeholder="0.00" 
                             className={`w-full border-none rounded-lg pl-4 pr-2 py-1.5 text-xs sm:text-sm font-bold focus:ring-1 focus:ring-emerald-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} 
                           />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase block">Tip (%)</label>
                      <input type="number" step="0.1" value={settings.tipRate} onChange={(e) => setSettings({...settings, tipRate: parseFloat(e.target.value) || 0})} className={`w-full border-none rounded-lg px-2 py-1.5 text-xs sm:text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none transition-colors ${darkMode ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-900'}`} />
                    </div>
                  </div>

                  <div className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 border transition-colors ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <div className="flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-blue-500" />
                        <span className={`text-[10px] sm:text-sm font-black uppercase tracking-wider transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Quick Split</span>
                      </div>
                      {guestCount > 1 && (
                        <div className="text-right">
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Per Person</p>
                          <p className="text-sm sm:text-base font-black text-blue-500">{formatCurrency(totals.grandTotal / guestCount)}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className={`p-1.5 sm:p-2 rounded-lg border transition-all shadow-sm active:scale-95 ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}><Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                      <div className={`flex-1 rounded-lg border flex items-center justify-center py-1.5 sm:py-2 shadow-sm transition-colors ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}><span className={`text-base sm:text-lg font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{guestCount}</span><span className="ml-1.5 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">People</span></div>
                      <button onClick={() => setGuestCount(guestCount + 1)} className={`p-1.5 sm:p-2 rounded-lg border transition-all shadow-sm active:scale-95 ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-100 hover:bg-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}><Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-1">
                    {[15, 18, 20, 22, 25].map(p => {
                      const prev = calculateTotals(
                        subtotal, 
                        settings.taxRate, 
                        p, 
                        settings.tipOnPreTax, 
                        settings.taxOnPostTip, 
                        settings.roundingMode, 
                        settings.taxAmount,
                        settings.isCashDiscountEnabled,
                        settings.cashDiscountRate
                      );
                      return (<button key={p} onClick={() => setSettings({...settings, tipRate: p})} className={`flex flex-col items-center py-1.5 sm:py-2 rounded-lg font-black transition-all ${settings.tipRate === p ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' : (darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100')}`}><span className="text-[10px] sm:text-xs">{p}%</span><span className="text-[7px] sm:text-[9px] opacity-70 leading-none">{formatCurrency(prev.tip)}</span></button>);
                    })}
                  </div>
                  
                  <div className={`pt-2 sm:pt-3 border-t grid grid-cols-2 gap-x-3 gap-y-2 transition-colors ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[9px] sm:text-[10px] font-bold transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Tip Base</span>
                      </div>
                      <div className={`relative flex p-0.5 rounded-lg w-full h-7 sm:h-8 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md shadow-sm transition-transform duration-300 ease-out z-0 ${darkMode ? 'bg-slate-700' : 'bg-white'} ${settings.tipOnPreTax ? 'translate-x-0' : 'translate-x-full'}`} />
                        <button onClick={() => setSettings(s => ({ ...s, tipOnPreTax: true }))} className={`relative z-10 flex-1 flex items-center justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-wider transition-colors ${settings.tipOnPreTax ? (darkMode ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'}`}>PRE</button>
                        <button onClick={() => setSettings(s => ({ ...s, tipOnPreTax: false }))} className={`relative z-10 flex-1 flex items-center justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-wider transition-colors ${!settings.tipOnPreTax ? (darkMode ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'}`}>POST</button>
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[9px] sm:text-[10px] font-bold transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Tax Basis</span>
                      </div>
                      <div className={`relative flex p-0.5 rounded-lg w-full h-7 sm:h-8 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md shadow-sm transition-transform duration-300 ease-out z-0 ${darkMode ? 'bg-slate-700' : 'bg-white'} ${!settings.taxOnPostTip ? 'translate-x-0' : 'translate-x-full'}`} />
                        <button onClick={() => setSettings(s => ({ ...s, taxOnPostTip: false }))} className={`relative z-10 flex-1 flex items-center justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-wider transition-colors ${!settings.taxOnPostTip ? (darkMode ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'}`}>SUB</button>
                        <button onClick={() => setSettings(s => ({ ...s, taxOnPostTip: true }))} className={`relative z-10 flex-1 flex items-center justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-wider transition-colors ${settings.taxOnPostTip ? (darkMode ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'}`}>POST</button>
                      </div>
                    </div>

                    <div className="space-y-0.5 col-span-2">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-[9px] sm:text-[10px] font-bold transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Overhead Distribution</span>
                      </div>
                      <div className={`relative flex p-0.5 rounded-lg w-full h-7 sm:h-8 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-md shadow-sm transition-transform duration-300 ease-out z-0 ${darkMode ? 'bg-slate-700' : 'bg-white'} ${settings.splitOverheadEqually ? 'translate-x-0' : 'translate-x-full'}`} />
                        <button onClick={() => setSettings(s => ({ ...s, splitOverheadEqually: true }))} className={`relative z-10 flex-1 flex items-center justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-wider transition-colors ${settings.splitOverheadEqually ? (darkMode ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'}`}>EVEN SPLIT</button>
                        <button onClick={() => setSettings(s => ({ ...s, splitOverheadEqually: false }))} className={`relative z-10 flex-1 flex items-center justify-center text-[7px] sm:text-[8px] font-black uppercase tracking-wider transition-colors ${!settings.splitOverheadEqually ? (darkMode ? 'text-blue-400' : 'text-blue-600') : 'text-slate-400'}`}>BY ORDER</button>
                      </div>
                    </div>

                    <div className="space-y-0.5 col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Rounding</label>
                      <div className={`grid grid-cols-4 p-0.5 rounded-lg gap-0.5 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        {[{id:'none', icon:Minus}, {id:'nearest', icon:Equal}, {id:'up', icon:ArrowUp}, {id:'down', icon:ArrowDown}].map(m => (
                          <button key={m.id} onClick={() => setSettings({...settings, roundingMode: m.id as RoundingMode})} className={`py-1 rounded-md flex items-center justify-center gap-1 transition-all ${settings.roundingMode === m.id ? (darkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white shadow-sm text-blue-600') : 'text-slate-400 hover:text-slate-200'}`}>
                            <m.icon className="w-2 h-2" />
                            <span className="text-[7px] font-black uppercase">{m.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4 animate-in slide-in-from-right-4">
                  <h4 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Tip Variation Grid</h4>
                  <div className={`overflow-hidden rounded-xl border transition-colors ${darkMode ? 'border-slate-800' : 'border-slate-100 shadow-sm'}`}>
                    <table className="w-full text-[10px] sm:text-xs border-collapse">
                      <thead className={`border-b uppercase font-black text-[8px] sm:text-[10px] transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <tr>
                          <th className="p-2 sm:p-3 text-left">TIP %</th>
                          <th className="p-2 sm:p-3 text-right">TAX</th>
                          <th className="p-2 sm:p-3 text-right">TIP</th>
                          <th className={`p-2 sm:p-3 text-right transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y transition-colors ${darkMode ? 'divide-slate-800' : 'divide-slate-50'}`}>
                        {comparisonData.map(row => (
                          <tr key={row.percentage} onClick={() => setSettings({...settings, tipRate: row.percentage})} className={`cursor-pointer transition-colors ${settings.tipRate === row.percentage ? (darkMode ? 'bg-blue-900/20' : 'bg-blue-50/70') : (darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50')}`}>
                            <td className={`p-2 sm:p-3 font-black transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>{row.percentage}%</td>
                            <td className="p-2 sm:p-3 text-right text-slate-500">{formatCurrency(row.totals.tax)}</td>
                            <td className={`p-2 sm:p-3 text-right font-bold transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{formatCurrency(row.totals.tip)}</td>
                            <td className={`p-2 sm:p-3 text-right font-black transition-colors ${darkMode ? 'text-blue-400' : 'text-slate-900'}`}>{formatCurrency(row.totals.grandTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className={`rounded-xl sm:rounded-2xl shadow-sm border overflow-hidden transition-colors ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className={`flex border-b transition-colors ${darkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
              <button onClick={() => setGuestTab('members')} className={`flex-1 py-2 flex items-center justify-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${guestTab === 'members' ? (darkMode ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'bg-white text-blue-600 border-b-2 border-blue-600') : 'text-slate-400'}`}><Users className="w-3 h-3" /> Guests</button>
              <button onClick={() => setGuestTab('matrix')} className={`flex-1 py-2 flex items-center justify-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all ${guestTab === 'matrix' ? (darkMode ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-400' : 'bg-white text-blue-600 border-b-2 border-blue-600') : 'text-slate-400'}`}><TableProperties className="w-3 h-3" /> Matrix</button>
            </div>
            <div className="p-2.5 sm:p-3">
              {guestTab === 'members' ? (
                <div className="space-y-1 sm:space-y-1.5 animate-in fade-in">
                  {users.length === 0 ? (
                    <div className={`py-6 px-4 text-center border-2 border-dashed rounded-xl transition-colors ${darkMode ? 'border-slate-800 bg-slate-800/20' : 'border-slate-100 bg-slate-50'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-1.5 transition-colors ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                        <UserPlus className="w-4 h-4 text-slate-400" />
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 mb-0.5">No guests added yet</p>
                      <p className="text-[7px] text-slate-300 uppercase tracking-widest font-black">Use Quick Split for even shares</p>
                    </div>
                  ) : (
                    users.map(user => {
                      const b = userBreakdown[user.id] || { base: 0, tax: 0, tip: 0, total: 0 };
                      return (
                        <div key={user.id} className={`rounded-lg p-1.5 sm:p-2 shadow-sm border group relative transition-all hover:border-blue-500/50 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                          <div className="flex justify-between items-center mb-0.5">
                            <div className="flex items-center gap-1.5 flex-1">
                              <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md ${user.color} flex items-center justify-center text-white font-black text-[8px] sm:text-[9px] shadow-sm`}>{user.name.charAt(0)}</div>
                              <div className="flex-1">
                                <input type="text" value={user.name} onChange={(e) => updateUserName(user.id, e.target.value)} className={`w-full bg-transparent border-none p-0 font-black focus:ring-0 text-[9px] sm:text-[10px] truncate transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`} />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs sm:text-sm font-black leading-none transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(b.total)}</p>
                            </div>
                          </div>
                          <div className={`flex justify-between text-[6px] sm:text-[7px] font-black text-slate-400 pt-0.5 border-t uppercase tracking-widest transition-colors ${darkMode ? 'border-slate-700' : 'border-slate-50'}`}>
                            <div className="flex gap-1"><span>BASE</span><span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(b.base)}</span></div>
                            <div className="flex gap-1"><span>TAX</span><span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(b.tax)}</span></div>
                            <div className="flex gap-1"><span>TIP</span><span className={`${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{formatCurrency(b.tip)}</span></div>
                          </div>
                          <button onClick={() => removeUser(user.id)} className="absolute -top-1 -right-1 p-0.5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"><Trash2 className="w-1.5 h-1.5" /></button>
                        </div>
                      );
                    })
                  )}
                  <button onClick={addUser} className={`w-full border-2 border-dashed rounded-xl py-2 font-black transition-all text-[9px] flex items-center justify-center gap-1.5 ${darkMode ? 'border-slate-800 text-slate-500 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-400/5' : 'border-slate-100 text-slate-400 hover:border-blue-200 hover:text-blue-500 hover:bg-blue-50/50'}`}><Plus className="w-3 h-3" /> ADD GUEST</button>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4 animate-in slide-in-from-right-4">
                  <div className={`flex p-0.5 rounded-lg transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button onClick={() => setRoundingTarget('bill')} className={`flex-1 py-1.5 rounded-md text-[9px] sm:text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${roundingTarget === 'bill' ? (darkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}><Banknote className="w-3.5 h-3.5" /> Bill</button>
                    <button onClick={() => setRoundingTarget('individual')} className={`flex-1 py-1.5 rounded-md text-[9px] sm:text-[10px] font-black transition-all flex items-center justify-center gap-1.5 ${roundingTarget === 'individual' ? (darkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : 'text-slate-400'}`}><UserCheck className="w-3.5 h-3.5" /> Guest</button>
                  </div>
                  <div className={`overflow-hidden rounded-xl border transition-colors ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <table className="w-full text-[9px] sm:text-[10px] border-collapse">
                      <thead className={`border-b uppercase font-black transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                        <tr>
                          <th className="p-2 text-left">GUEST</th>
                          <th className="p-2 text-right">NONE</th>
                          <th className="p-2 text-right">NEAR</th>
                          <th className="p-2 text-right">UP</th>
                          <th className="p-2 text-right">DOWN</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y transition-colors ${darkMode ? 'divide-slate-800' : 'divide-slate-50'}`}>
                        {users.map(user => (
                          <tr key={user.id} className={`transition-colors ${darkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/50'}`}>
                            <td className={`p-2 font-bold transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{user.name}</td>
                            {roundingModes.map(mode => (
                              <td key={mode} className={`p-2 text-right font-medium transition-colors ${settings.roundingMode === mode ? (darkMode ? 'text-blue-400 bg-blue-900/10 font-black' : 'text-blue-600 bg-blue-50/30 font-black') : 'text-slate-500'}`}>
                                {formatCurrency(roundingMatrixData.find(d => d.mode === mode)?.breakdown[user.id]?.total || 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className={`border-t-2 font-black transition-colors ${darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50/80 border-slate-100'}`}>
                        <tr>
                          <td className={`p-2 uppercase transition-colors ${darkMode ? 'text-slate-300' : 'text-slate-900'}`}>Sum</td>
                          {roundingModes.map(mode => (
                            <td key={mode} className={`p-2 text-right transition-colors ${settings.roundingMode === mode ? (darkMode ? 'text-blue-400' : 'text-blue-700') : (darkMode ? 'text-slate-100' : 'text-slate-900')}`}>
                              {formatCurrency(roundingMatrixData.find(d => d.mode === mode)?.sumTotal || 0)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-lg border flex gap-2 items-start transition-colors ${darkMode ? 'bg-blue-900/10 border-blue-900/40' : 'bg-blue-50/50 border-blue-100'}`}>
                    <Info className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className={`text-[8px] sm:text-[10px] font-medium leading-relaxed transition-colors ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      {roundingTarget === 'bill' 
                        ? 'Global rounding: Adjusts tip to clean the grand total.' 
                        : 'Guest rounding: Rounds each individual share to nearest dollar.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <SummaryFooter totals={totals} settings={settings} darkMode={darkMode} />
      <AssignmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} items={items.filter(i => selectedItemIds.has(i.id))} users={users} currentAssignments={assignments} onSave={saveAssignments} darkMode={darkMode} />
    </div>
  );
};

export default App;
