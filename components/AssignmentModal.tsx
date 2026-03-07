
import React, { useState, useEffect } from 'react';
import { User, ReceiptItem, Assignment } from '../types';
import { formatCurrency, precise } from '../utils/math';
import { X, Users, Check, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: ReceiptItem[];
  users: User[];
  onSave: (itemId: string, assignments: Assignment[]) => void;
  currentAssignments: Record<string, Assignment[]>;
  darkMode?: boolean;
}

const AssignmentModal: React.FC<Props> = ({ isOpen, onClose, items, users, onSave, currentAssignments, darkMode }) => {
  const [activeTab, setActiveTab] = useState<'equal' | 'custom'>('equal');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (items.length === 1) {
      const existing = currentAssignments[items[0].id] || [];
      const userIds = new Set(existing.map(a => a.userId));
      setSelectedUserIds(userIds);
      
      const custom: Record<string, string> = {};
      existing.forEach(a => {
        custom[a.userId] = a.amount.toString();
      });
      setCustomAmounts(custom);
    } else {
      setSelectedUserIds(new Set());
      setCustomAmounts({});
    }
  }, [items, currentAssignments]);

  if (!isOpen) return null;

  const totalPrice = items.reduce((acc, item) => acc + item.price, 0);
  const isMulti = items.length > 1;

  const handleToggleUser = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const handleSelectEveryone = () => {
    setSelectedUserIds(new Set(users.map(u => u.id)));
  };

  const handleSave = () => {
    const assignments: Assignment[] = [];
    
    if (activeTab === 'equal') {
      const count = selectedUserIds.size;
      if (count === 0) return;
      const amountPerUser = precise(totalPrice / count);
      let totalAssigned = 0;
      const ids: string[] = Array.from(selectedUserIds);
      ids.forEach((id, idx) => {
        if (idx === ids.length - 1) {
          assignments.push({ userId: id, amount: precise(totalPrice - totalAssigned) });
        } else {
          assignments.push({ userId: id, amount: amountPerUser });
          totalAssigned += amountPerUser;
        }
      });
    } else {
      (Object.entries(customAmounts) as [string, string][]).forEach(([userId, amount]) => {
        const val = parseFloat(amount);
        if (!isNaN(val) && val > 0) {
          assignments.push({ userId, amount: val });
        }
      });
    }

    items.forEach(item => {
      const itemAssignments = assignments.map(a => ({
        userId: a.userId,
        amount: precise((item.price / totalPrice) * a.amount)
      }));
      onSave(item.id, itemAssignments);
    });
    onClose();
  };

  const customTotal = (Object.values(customAmounts) as string[]).reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0);
  const isValid = activeTab === 'equal' ? selectedUserIds.size > 0 : precise(customTotal) === precise(totalPrice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className={`rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        <div className={`p-4 border-b flex justify-between items-center transition-colors ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <h2 className={`text-lg font-bold transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>Assign Items</h2>
            <p className="text-xs text-slate-500">
              {isMulti ? `${items.length} items selected` : items[0].name} • {formatCurrency(totalPrice)}
            </p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-full transition-all ${darkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3">
          <div className={`flex p-0.5 rounded-lg mb-4 transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <button 
              onClick={() => setActiveTab('equal')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-black transition-all ${activeTab === 'equal' ? (darkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-400'}`}
            >
              Equal Split
            </button>
            <button 
              onClick={() => setActiveTab('custom')}
              className={`flex-1 py-1.5 px-3 rounded-md text-xs font-black transition-all ${activeTab === 'custom' ? (darkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white shadow-sm text-blue-600') : 'text-slate-500 hover:text-slate-400'}`}
            >
              Custom Amount
            </button>
          </div>

          <div className="space-y-2 max-h-[35vh] overflow-y-auto tight-scroll pr-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Select People</span>
              {activeTab === 'equal' && (
                <button 
                  onClick={handleSelectEveryone}
                  className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-1"
                >
                  <Users className="w-2.5 h-2.5" /> Select Everyone
                </button>
              )}
            </div>
            
            {users.map((user) => (
              <div 
                key={user.id}
                onClick={() => activeTab === 'equal' && handleToggleUser(user.id)}
                className={`group flex items-center justify-between p-2 rounded-xl border-2 transition-all cursor-pointer ${
                  activeTab === 'equal' 
                  ? (selectedUserIds.has(user.id) ? (darkMode ? 'border-blue-500 bg-blue-900/10' : 'border-blue-500 bg-blue-50') : (darkMode ? 'border-slate-800 hover:border-slate-700' : 'border-slate-100 hover:border-slate-200'))
                  : (darkMode ? 'border-slate-800' : 'border-slate-100')
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg ${user.color} flex items-center justify-center text-white font-black text-[10px] shadow-sm`}>
                    {user.name.charAt(0)}
                  </div>
                  <span className={`text-sm font-bold transition-colors ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{user.name}</span>
                </div>

                {activeTab === 'equal' ? (
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedUserIds.has(user.id) ? 'bg-blue-500 border-blue-500' : (darkMode ? 'border-slate-700' : 'border-slate-200')}`}>
                    {selectedUserIds.has(user.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      className={`w-20 pl-5 pr-2 py-1 border rounded-lg text-right text-xs font-bold focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                      placeholder="0.00"
                      value={customAmounts[user.id] || ''}
                      onChange={(e) => setCustomAmounts({...customAmounts, [user.id]: e.target.value})}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={`p-4 flex flex-col gap-3 transition-colors ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
          {activeTab === 'custom' && (
            <div className={`flex items-center justify-between text-[10px] p-2 rounded-lg font-bold uppercase tracking-wider transition-colors ${precise(customTotal) === precise(totalPrice) ? (darkMode ? 'bg-emerald-900/20 text-emerald-400' : 'bg-emerald-100 text-emerald-800') : (darkMode ? 'bg-orange-900/20 text-orange-400' : 'bg-orange-100 text-orange-800')}`}>
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {precise(customTotal) === precise(totalPrice) ? 'Total matches!' : `Remaining: ${formatCurrency(totalPrice - customTotal)}`}
              </span>
              <span>{formatCurrency(customTotal)} / {formatCurrency(totalPrice)}</span>
            </div>
          )}

          <button 
            disabled={!isValid}
            onClick={handleSave}
            className={`w-full py-3 rounded-xl font-black text-base transition-all shadow-lg ${isValid ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-blue-500/20' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
          >
            Confirm Split
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentModal;
