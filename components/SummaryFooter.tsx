
import React, { useState } from 'react';
import { Totals, SplitSettings } from '../types';
import { formatCurrency } from '../utils/math';
import { Info, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  totals: Totals;
  settings: SplitSettings;
  darkMode?: boolean;
}

const SummaryFooter: React.FC<Props> = ({ totals, settings, darkMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-2 pb-2 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto">
        <div className={`rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-900 border-transparent'} text-white`}>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full py-1.5 flex justify-center transition-colors border-b ${darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}
          >
            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
          </button>

          {isExpanded && (
            <div className={`px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4 duration-300 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-slate-900'}`}>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Subtotal</p>
                <p className="text-lg font-black">{formatCurrency(totals.subtotal)}</p>
                {settings.isCashDiscountEnabled && (
                  <p className="text-[9px] text-emerald-400 font-bold italic">-{formatCurrency(totals.cashDiscountAmount)} cash disc.</p>
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Tax {settings.taxAmount !== null ? '' : `(${settings.taxRate}%)`}</p>
                <p className="text-lg font-black">{formatCurrency(totals.tax)}</p>
                <p className="text-[9px] text-blue-400 font-bold italic">on {settings.taxOnPostTip ? 'Post-tip' : 'Subtotal'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Tip ({settings.tipRate}%)</p>
                <p className="text-lg font-black">{formatCurrency(totals.tip)}</p>
                <p className="text-[9px] text-blue-400 font-bold italic">on {settings.tipOnPreTax ? 'Pre-tax' : 'Post-tax'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">Grand Total</p>
                <p className="text-lg font-black text-emerald-400">{formatCurrency(totals.grandTotal)}</p>
                {settings.roundingMode !== 'none' && <span className="text-[8px] font-black bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-lg uppercase tracking-wider">Rounded {settings.roundingMode}</span>}
              </div>
            </div>
          )}

          <div className="px-4 py-2.5 flex flex-col items-center justify-center gap-0.5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none">Final Bill</p>
            <p className="text-3xl font-black text-white leading-tight">{formatCurrency(totals.grandTotal)}</p>
            <div className="sm:flex hidden items-center gap-1 text-slate-400 mt-0.5">
               <Info className="w-3 h-3" />
               <span className="text-[8px] font-black uppercase tracking-widest">Equally split if unassigned</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryFooter;
