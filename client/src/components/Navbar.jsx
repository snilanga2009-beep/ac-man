import React from 'react';
import { useAuth } from '../context/AuthContext';
import SuperAdminCompanySwitcher from './SuperAdminCompanySwitcher';
import { Airplay, LogOut, UserCircle, Shield, Wrench, Building, Menu } from 'lucide-react';

export default function Navbar({ onToggleMobileMenu }) {
  const { user, company, logout } = useAuth();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield className="w-3 h-3" /> Super Admin
          </span>
        );
      case 'COMPANY_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Building className="w-3 h-3" /> Company Admin
          </span>
        );
      case 'TECHNICIAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Wrench className="w-3 h-3" /> Technician PWA
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
            Staff
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-2">
          {/* Left: Mobile Menu Toggle & Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger Button for Mobile / Tablet (< lg) */}
            <button
              onClick={onToggleMobileMenu}
              className="p-2 rounded-xl text-slate-600 hover:text-sky-600 hover:bg-slate-100 lg:hidden transition-colors"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Brand Logo */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#22C55E] via-[#16A34A] to-[#15803D] flex items-center justify-center text-white shadow-md shadow-emerald-600/25 shrink-0">
              <Airplay className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-[#16A34A]">
                  AC-Pro
                </span>
                <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.2 rounded-full bg-[#F59E0B] text-slate-900 tracking-wider uppercase shadow-2xs">
                  SaaS
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate max-w-[140px] sm:max-w-xs">
                {company?.name || (user?.role === 'SUPER_ADMIN' ? 'Super Admin Portal' : 'Field Platform')}
              </p>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SuperAdminCompanySwitcher />

            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-200">
              {getRoleBadge(user?.role)}
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{user?.name}</p>
                <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
