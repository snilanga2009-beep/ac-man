import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Building2, ChevronDown, Check, ShieldAlert } from 'lucide-react';

export default function SuperAdminCompanySwitcher() {
  const { user, activeCompanyContext, switchCompanyContext } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      axios.get('/api/super-admin/companies')
        .then(res => setCompanies(res.data))
        .catch(err => console.error('Failed to load companies list for switcher:', err));
    }
  }, [user]);

  if (user?.role !== 'SUPER_ADMIN') return null;

  const currentCompany = companies.find(c => String(c.id) === String(activeCompanyContext));

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
          activeCompanyContext
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 hover:bg-amber-500/20'
            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
        }`}
      >
        <Building2 className="w-4 h-4 text-amber-500" />
        <span>
          {currentCompany ? `Tenant: ${currentCompany.name}` : 'Platform View (All Companies)'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center justify-between">
            <span>Switch Company Workspace</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            <button
              onClick={() => {
                switchCompanyContext(null);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                !activeCompanyContext ? 'text-sky-600 font-bold bg-sky-50' : 'text-slate-700'
              }`}
            >
              <div>
                <p className="font-semibold">Master Super Admin View</p>
                <p className="text-[10px] text-slate-400">All companies overview & platform metrics</p>
              </div>
              {!activeCompanyContext && <Check className="w-4 h-4 text-sky-600" />}
            </button>

            {companies.map(comp => {
              const isSelected = String(comp.id) === String(activeCompanyContext);
              return (
                <button
                  key={comp.id}
                  onClick={() => {
                    switchCompanyContext(comp.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    isSelected ? 'text-sky-600 font-bold bg-sky-50' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{comp.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {comp.billing?.active_technicians || 0} Techs • {comp.status}
                    </p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-sky-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
