import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Wrench,
  FileText,
  Menu,
  QrCode,
  BarChart3
} from 'lucide-react';

export default function MobileBottomNav({ onOpenMenu }) {
  const { user } = useAuth();
  const role = user?.role;

  const getBottomNavClass = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl text-[10px] transition-all ${
      isActive
        ? 'text-[#16A34A] font-black'
        : 'text-slate-500 font-semibold hover:text-slate-900'
    }`;

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 z-30 lg:hidden flex justify-around items-center py-1.5 px-2 shadow-lg safe-area-bottom">
      {/* TECHNICIAN ROLE */}
      {(role === 'TECHNICIAN' || role === 'FREELANCE_TECHNICIAN') && (
        <>
          <NavLink to="/technician/pwa" className={getBottomNavClass}>
            <Wrench className="w-5 h-5" />
            <span>My Jobs</span>
          </NavLink>
          <NavLink to="/technician/reports" className={getBottomNavClass}>
            <BarChart3 className="w-5 h-5" />
            <span>Reports</span>
          </NavLink>
          <NavLink to="/technician/qr-scanner" className={getBottomNavClass}>
            <QrCode className="w-5 h-5" />
            <span>Scan QR</span>
          </NavLink>
          <button
            onClick={onOpenMenu}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-900"
          >
            <Menu className="w-5 h-5" />
            <span>Menu</span>
          </button>
        </>
      )}

      {/* COMPANY ADMIN ROLE */}
      {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN') && role !== 'TECHNICIAN' && (
        <>
          <NavLink to="/company/dashboard" className={getBottomNavClass}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/company/quotations" className={getBottomNavClass}>
            <FileText className="w-5 h-5" />
            <span>Quotations</span>
          </NavLink>
          <NavLink to="/company/reports" className={getBottomNavClass}>
            <BarChart3 className="w-5 h-5" />
            <span>Reports</span>
          </NavLink>
          <NavLink to="/company/jobs" className={getBottomNavClass}>
            <Calendar className="w-5 h-5" />
            <span>Jobs</span>
          </NavLink>
          <button
            onClick={onOpenMenu}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-900"
          >
            <Menu className="w-5 h-5 text-sky-600" />
            <span>All Menu</span>
          </button>
        </>
      )}
    </nav>
  );
}
