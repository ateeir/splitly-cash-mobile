
import React, { useState } from 'react';
import { ReceiptItem, Assignment, User } from '../types';
import { formatCurrency, precise } from '../utils/math';
import { Check, UserPlus, Edit3, Save } from 'lucide-react';

interface Props {
  item: ReceiptItem;
  assignments: Assignment[];
  users: User[];
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAssignClick: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ReceiptItem>) => void;
  darkMode?: boolean;
}

const ReceiptItemCard: React.FC<Props> = ({ item, assignments, users, isSelected, onSelect, onAssignClick, onUpdate, darkMode }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(item.name);
  const [tempPrice, setTempPrice] = useState(item.price.toString());

  const totalAssigned = assignments.reduce((acc, a) => acc + a.amount, 0);
  const isFullyAssigned = precise(totalAssigned) >= precise(item.price);
  const isPartiallyAssigned = totalAssigned > 0 && !isFullyAssigned;

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(item.id, {
      name: tempName,
      price: parseFloat(tempPrice) || 0
    });
    setIsEditing(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const cardBaseClasses = `relative group p-2 sm:p-2.5 rounded-lg sm:rounded-xl border-2 transition-all cursor-pointer shadow-sm`;
  const themeClasses = darkMode 
    ? (isSelected ? 'border-blue-500 bg-blue-900/20 ring-2 ring-blue-500/10' : 
       isFullyAssigned ? 'border-emerald-500/30 bg-emerald-900/10' : 
       isPartiallyAssigned ? 'border-orange-500/30 bg-orange-900/10' :
       'border-slate-800 bg-slate-900 hover:border-slate-700')
    : (isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 
       isFullyAssigned ? 'border-emerald-100 bg-emerald-50/30' : 
       isPartiallyAssigned ? 'border-orange-100 bg-orange-50/30' :
       'border-white bg-white hover:border-slate-200');

  return (
    <div 
      className={`${cardBaseClasses} ${themeClasses}`}
      onClick={() => !isEditing && onSelect(item.id)}
    >
      <div className="flex justify-between items-start mb-1.5 sm:mb-2">
        <div className="flex items-start gap-1.5 sm:gap-2 flex-1">
          {!isEditing && (
            <div className={`mt-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : (darkMode ? 'border-slate-700' : 'border-slate-300 group-hover:border-slate-400')}`}>
              {isSelected && <Check className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-white" />}
            </div>
          )}
          
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-1 sm:space-y-1.5" onClick={e => e.stopPropagation()}>
                <input 
                  autoFocus
                  className={`w-full text-[10px] sm:text-xs font-bold border rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                />
                <div className="relative">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] sm:text-[10px]">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className={`w-full text-[10px] sm:text-xs font-bold border rounded pl-4 pr-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                    value={tempPrice}
                    onChange={e => setTempPrice(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <>
                <h4 className={`text-xs sm:text-sm font-semibold line-clamp-1 transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>{item.name}</h4>
                <p className={`text-[10px] sm:text-xs font-medium transition-colors ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{formatCurrency(item.price)}</p>
              </>
            )}
          </div>
        </div>
        
        <div className="flex gap-0.5">
          {isEditing ? (
            <button 
              onClick={handleSave}
              className="p-1 sm:p-1.5 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Save className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          ) : (
            <>
              <button 
                onClick={handleEditClick}
                className={`p-1 sm:p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${darkMode ? 'bg-slate-800 text-slate-400 hover:text-blue-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
              >
                <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onAssignClick(item.id); }}
                className={`p-1 sm:p-1.5 rounded-lg transition-all shadow-sm active:scale-95 ${isFullyAssigned ? 'bg-emerald-500 text-white' : (darkMode ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-white text-blue-600 hover:bg-blue-50')}`}
              >
                <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {assignments.length > 0 && !isEditing && (
        <div className="flex flex-wrap gap-0.5 mt-0.5 sm:mt-1">
          {assignments.map((a, i) => {
            const user = users.find(u => u.id === a.userId);
            return (
              <div 
                key={i} 
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ${user?.color || 'bg-slate-400'}`}
                title={`${user?.name}: ${formatCurrency(a.amount)}`}
              >
                {user?.name.charAt(0)}
                <span className="opacity-90">{formatCurrency(a.amount)}</span>
              </div>
            );
          })}
        </div>
      )}

      {isPartiallyAssigned && !isEditing && (
        <div className={`mt-1 sm:mt-1.5 h-0.5 w-full rounded-full overflow-hidden transition-colors ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div 
            className="h-full bg-orange-400 transition-all duration-500" 
            style={{ width: `${(totalAssigned / item.price) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ReceiptItemCard;
