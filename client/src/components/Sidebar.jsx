import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  Wrench,
  CreditCard,
  MessageSquare,
  Smartphone,
  Settings,
  ShieldCheck,
  Calendar,
  FileText,
  Clock,
  Sparkles,
  QrCode,
  Sliders,
  DollarSign,
  X,
  Airplay,
  BarChart3,
  Activity
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { user, company } = useAuth();
  const role = user?.role;

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
      isActive
        ? 'bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white shadow-md shadow-emerald-600/25 font-bold'
        : 'text-slate-600 hover:text-[#16A34A] hover:bg-emerald-50/70'
    }`;

  const navContent = (
    <div className="space-y-6">
      {/* Breeze User Profile Card */}
      <div className="p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3 truncate">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#22C55E] to-[#0EA5E9] text-white font-bold flex items-center justify-center text-sm shadow-sm shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-black text-slate-800 truncate">{user?.name || 'Admin'}</h4>
            <p className="text-[10px] font-bold text-[#16A34A] truncate">
              {company?.name || (role === 'SUPER_ADMIN' ? 'Platform Master' : 'AC-Pro')}
            </p>
          </div>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-4 ring-[#22C55E]/20 shrink-0"></span>
      </div>
      {/* SUPER ADMIN MENU */}
      {role === 'SUPER_ADMIN' && (
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Super Admin Master
          </p>
          <nav className="space-y-1">
            <NavLink to="/super-admin/dashboard" onClick={handleLinkClick} className={getNavLinkClass}>
              <LayoutDashboard className="w-4 h-4" /> Platform Dashboard
            </NavLink>
            <NavLink to="/super-admin/reports" onClick={handleLinkClick} className={getNavLinkClass}>
              <BarChart3 className="w-4 h-4 text-emerald-500" /> Earnings & Tech Reports
            </NavLink>
            <NavLink to="/super-admin/companies" onClick={handleLinkClick} className={getNavLinkClass}>
              <Building2 className="w-4 h-4" /> AC Companies
            </NavLink>
            <NavLink to="/super-admin/billing" onClick={handleLinkClick} className={getNavLinkClass}>
              <DollarSign className="w-4 h-4 text-emerald-500" /> SaaS Billing & Revenue
            </NavLink>
            <NavLink to="/super-admin/pricing" onClick={handleLinkClick} className={getNavLinkClass}>
              <Sliders className="w-4 h-4" /> SaaS Technician Pricing
            </NavLink>
            <NavLink to="/super-admin/technicians" onClick={handleLinkClick} className={getNavLinkClass}>
              <Wrench className="w-4 h-4" /> All Technicians
            </NavLink>
            <NavLink to="/super-admin/quotations" onClick={handleLinkClick} className={getNavLinkClass}>
              <FileText className="w-4 h-4 text-[#00CCCD]" /> Quotations & Estimates
            </NavLink>
            <NavLink to="/super-admin/invoices" onClick={handleLinkClick} className={getNavLinkClass}>
              <FileText className="w-4 h-4" /> All Invoices
            </NavLink>
            <NavLink to="/super-admin/sms-gateway" onClick={handleLinkClick} className={getNavLinkClass}>
              <MessageSquare className="w-4 h-4 text-sky-500" /> Text.lk SMS Gateway
            </NavLink>
            <NavLink to="/super-admin/whatsapp-gateway" onClick={handleLinkClick} className={getNavLinkClass}>
              <Smartphone className="w-4 h-4 text-emerald-500" /> WhatsApp Gateway
            </NavLink>
            <NavLink to="/super-admin/service-packages" onClick={handleLinkClick} className={getNavLinkClass}>
              <Sparkles className="w-4 h-4 text-amber-500" /> Global Service Packages
            </NavLink>
            <NavLink to="/super-admin/audit-logs" onClick={handleLinkClick} className={getNavLinkClass}>
              <ShieldCheck className="w-4 h-4" /> SaaS Audit Logs
            </NavLink>
          </nav>
        </div>
      )}

      {/* COMPANY ADMIN / TENANT MENU */}
      {(role === 'COMPANY_ADMIN' || role === 'SUPER_ADMIN' || role === 'COMPANY_OWNER' || role === 'SERVICE_MANAGER' || role === 'ACCOUNTANT') && (
        <div className="space-y-4">
          {/* Group 1: Operations & Live Dispatch */}
          <div>
            <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Operations &amp; Dispatch
            </p>
            <nav className="space-y-0.5">
              <NavLink to="/company/dashboard" onClick={handleLinkClick} className={getNavLinkClass}>
                <LayoutDashboard className="w-4 h-4" /> Company Dashboard
              </NavLink>
              <NavLink to="/company/live-monitor" onClick={handleLinkClick} className={getNavLinkClass}>
                <Activity className="w-4 h-4 text-emerald-500" />
                <span className="flex-1">Live Job Monitor</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-700 border border-emerald-400/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE
                </span>
              </NavLink>
              <NavLink to="/company/jobs" onClick={handleLinkClick} className={getNavLinkClass}>
                <Wrench className="w-4 h-4 text-emerald-500" /> Service Jobs
              </NavLink>
              <NavLink to="/company/calendar" onClick={handleLinkClick} className={getNavLinkClass}>
                <Calendar className="w-4 h-4 text-[#00CCCD]" /> Schedule Calendar
              </NavLink>
              <NavLink to="/company/reminders" onClick={handleLinkClick} className={getNavLinkClass}>
                <Clock className="w-4 h-4 text-amber-500" /> Service Reminders
              </NavLink>
            </nav>
          </div>

          {/* Group 2: Customers & AC Assets */}
          <div>
            <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Customers &amp; AC Assets
            </p>
            <nav className="space-y-0.5">
              <NavLink to="/company/customers" onClick={handleLinkClick} className={getNavLinkClass}>
                <Users className="w-4 h-4 text-blue-500" /> Customers
              </NavLink>
              <NavLink to="/company/ac-units" onClick={handleLinkClick} className={getNavLinkClass}>
                <QrCode className="w-4 h-4 text-purple-500" /> AC Units &amp; QR Codes
              </NavLink>
              <NavLink to="/company/quotations" onClick={handleLinkClick} className={getNavLinkClass}>
                <FileText className="w-4 h-4 text-[#00CCCD]" /> Quotations &amp; Estimates
              </NavLink>
            </nav>
          </div>

          {/* Group 3: Team, Finance & Commissions */}
          <div>
            <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Team &amp; Financials
            </p>
            <nav className="space-y-0.5">
              <NavLink to="/company/freelance" onClick={handleLinkClick} className={getNavLinkClass}>
                <DollarSign className="w-4 h-4 text-teal-500" /> Freelance Commissions
              </NavLink>
              <NavLink to="/company/invoices" onClick={handleLinkClick} className={getNavLinkClass}>
                <FileText className="w-4 h-4 text-amber-500" /> Invoices &amp; Payments
              </NavLink>
              <NavLink to="/company/technicians" onClick={handleLinkClick} className={getNavLinkClass}>
                <Wrench className="w-4 h-4 text-indigo-500" /> Technicians &amp; Fleet
              </NavLink>
              <NavLink to="/company/reports" onClick={handleLinkClick} className={getNavLinkClass}>
                <BarChart3 className="w-4 h-4 text-emerald-500" /> Earnings &amp; Reports
              </NavLink>
            </nav>
          </div>

          {/* Group 4: Gateways & Settings */}
          <div>
            <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
              Gateways &amp; Settings
            </p>
            <nav className="space-y-0.5">
              <NavLink to="/company/service-packages" onClick={handleLinkClick} className={getNavLinkClass}>
                <Sparkles className="w-4 h-4 text-amber-500" /> Service Packages
              </NavLink>
              <NavLink to="/company/communications" onClick={handleLinkClick} className={getNavLinkClass}>
                <MessageSquare className="w-4 h-4 text-slate-500" /> SMS / WhatsApp Logs
              </NavLink>
              <NavLink to="/company/whatsapp-gateway" onClick={handleLinkClick} className={getNavLinkClass}>
                <Smartphone className="w-4 h-4 text-emerald-500" /> WhatsApp Gateway
              </NavLink>
              <NavLink to="/company/sms-gateway" onClick={handleLinkClick} className={getNavLinkClass}>
                <MessageSquare className="w-4 h-4 text-sky-500" /> SMS Gateway
              </NavLink>
              <NavLink to="/company/billing" onClick={handleLinkClick} className={getNavLinkClass}>
                <CreditCard className="w-4 h-4 text-blue-500" /> SaaS Subscription
              </NavLink>
              <NavLink to="/company/profile" onClick={handleLinkClick} className={getNavLinkClass}>
                <Settings className="w-4 h-4 text-slate-500" /> Company Settings
              </NavLink>
            </nav>
          </div>
        </div>
      )}

      {/* TECHNICIAN MENU */}
      {(role === 'TECHNICIAN' || role === 'FREELANCE_TECHNICIAN') && (
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Technician Field App
          </p>
          <nav className="space-y-1">
            <NavLink to="/technician/pwa" onClick={handleLinkClick} className={getNavLinkClass}>
              <Wrench className="w-4 h-4" /> My Assigned Jobs
            </NavLink>
            <NavLink to="/technician/freelance" onClick={handleLinkClick} className={getNavLinkClass}>
              <DollarSign className="w-4 h-4 text-[#00CCCD]" /> My Freelance Earnings
            </NavLink>
            <NavLink to="/technician/reports" onClick={handleLinkClick} className={getNavLinkClass}>
              <BarChart3 className="w-4 h-4 text-emerald-500" /> Earnings & Tech Reports
            </NavLink>
            <NavLink to="/technician/qr-scanner" onClick={handleLinkClick} className={getNavLinkClass}>
              <QrCode className="w-4 h-4" /> Scan AC QR Code
            </NavLink>
          </nav>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* DESKTOP PERSISTENT SIDEBAR (Hidden on mobile / tablet < lg) */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] p-4 flex-col justify-between shrink-0">
        {navContent}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center mt-6">
          <p className="text-[11px] font-bold text-slate-700">Text.lk & WhatsApp Ready</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Multi-Tenant SaaS Engine</p>
        </div>
      </aside>

      {/* MOBILE SLIDE-OUT DRAWER OVERLAY */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl p-5 flex flex-col justify-between z-10 overflow-y-auto animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-sm">
                    <Airplay className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">AC-Pro Portal</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{role?.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              {navContent}
            </div>

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] font-bold text-slate-700">AC-Pro Responsive SaaS</p>
              <p className="text-[10px] text-slate-400">PWA Mobile Compatible</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
