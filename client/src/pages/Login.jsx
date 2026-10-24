import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Airplay,
  Shield,
  Building,
  Building2,
  Wrench,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Smartphone,
  Sparkles,
  Wifi,
  CheckCircle2,
  Tag,
  Zap,
  Clock,
  ChevronRight,
  Flame,
  PhoneCall,
  Check
} from 'lucide-react';
import { LIVE_TUNNEL_TECH_URL } from '../utils/tunnelConfig';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('AC');
  const { user, login } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (user.role === 'TECHNICIAN') {
        navigate('/technician/pwa', { replace: true });
      } else {
        navigate('/company/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      setLoading(false);
      if (user.role === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard');
      } else if (user.role === 'TECHNICIAN') {
        navigate('/technician/pwa');
      } else {
        navigate('/company/dashboard');
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Invalid credentials. Please verify and try again.');
    }
  };

  const setDemoCredentials = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  const serviceCategories = [
    { id: 'AC', label: 'AC Service', count: '12 Active' },
    { id: 'GAS', label: 'Gas Charging', count: 'Fast Refill' },
    { id: 'WASH', label: 'Pressure Wash', count: 'Chemical' },
    { id: 'REPAIR', label: 'Repairs & Parts', count: '24/7' },
    { id: 'MAINT', label: 'Preventive Plan', count: 'Annual' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0FDF4] via-[#F8FAFC] to-[#ECFDF5] flex flex-col justify-center py-6 px-3 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Soft Ambient Background Glows */}
      <div className="absolute top-0 right-10 w-[500px] h-[500px] bg-gradient-to-br from-[#22C55E]/15 via-[#86EFAC]/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 left-10 w-[450px] h-[450px] bg-gradient-to-tr from-[#0EA5E9]/10 via-[#F59E0B]/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto">
        {/* Top Mobile Quick Test Bar */}
        <div className="mb-4 bg-white/90 backdrop-blur-md border border-emerald-100 rounded-2xl p-2.5 sm:px-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#22C55E] text-white shadow-xs">
              <Smartphone className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800">Mobile & PWA Ready</span>
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Wi-Fi & 4G/5G
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                Live Tunnel: <span className="text-emerald-700 font-bold">{LIVE_TUNNEL_TECH_URL}</span>
              </p>
            </div>
          </div>
          <a
            href={LIVE_TUNNEL_TECH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-all shadow-xs shrink-0"
          >
            <span>Open PWA View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Top Dedicated Portal Links (Company Admin & Technician OTP App) */}
        <div className="mb-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3 sm:px-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-black text-white">Dedicated Portals: Company Admin & Field Technician OTP App</p>
              <p className="text-[11px] text-slate-300 truncate">
                Company Admins & Technicians (Company + Freelance) can sign in via their dedicated portals
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to="/technician/login"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00CCCD] hover:brightness-105 text-slate-950 font-black text-xs transition-all shadow-sm"
            >
              <Wrench className="w-3.5 h-3.5 text-slate-950" />
              <span>Technician OTP Login</span>
            </Link>
            <Link
              to="/company/login"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:opacity-95 text-slate-950 font-black text-xs transition-all shadow-sm"
            >
              <span>Company Admin Login</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
            </Link>
          </div>
        </div>

        {/* Card Split Layout (PC: 2 Cols | Mobile: Stacked) */}
        <div className="bg-white rounded-[28px] sm:rounded-[36px] shadow-2xl shadow-emerald-950/5 border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Hero Section (Handyman Green Banner Theme) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#22C55E] via-[#16A34A] to-[#15803D] text-white p-6 sm:p-10 flex flex-col justify-between relative overflow-hidden">
            {/* Ambient Background Circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-900/30 rounded-full blur-2xl pointer-events-none -ml-20 -mb-20"></div>

            <div className="relative z-10">
              {/* Brand Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-11 h-11 rounded-2xl bg-white text-[#16A34A] flex items-center justify-center shadow-lg shadow-emerald-900/20 font-black">
                  <Airplay className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white leading-tight">
                    AC-Pro SaaS
                  </h1>
                  <span className="text-[11px] font-bold text-emerald-100 tracking-wide uppercase">
                    Smart Air Conditioning Cloud
                  </span>
                </div>
              </div>

              {/* Main Headline (Inspired by Handyman Services) */}
              <div className="my-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black text-white mb-3 border border-white/25">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Next-Gen Field Service Management</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Handyman & AC Services
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-emerald-50 leading-relaxed font-medium">
                  Home maintenance and enterprise HVAC management made simple, fast & automated.
                </p>
              </div>

              {/* Category Pills (Like Handyman Design) */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-100 mb-2.5">
                  <span>Categories</span>
                  <span className="text-[11px] text-white/80 hover:text-white cursor-pointer">Explore All</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {serviceCategories.map((cat) => {
                    const active = activeCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                          active
                            ? 'bg-white text-[#16A34A] shadow-md shadow-emerald-900/20 scale-105'
                            : 'bg-white/15 text-white hover:bg-white/25 border border-white/10'
                        }`}
                      >
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Offer Banner Card (Inspired by 25% OFF Card in image) */}
              <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F59E0B] text-slate-900 text-[10px] font-black uppercase tracking-wider mb-2 shadow-xs">
                      Special Offer
                    </span>
                    <h4 className="text-sm font-black text-white">25% OFF Summer Overhaul</h4>
                    <p className="text-[11px] text-emerald-100 mt-0.5">
                      Preventive chemical cleaning & gas check for registered clients.
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Tag className="w-5 h-5 text-amber-300" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Quick Feature Checkmarks */}
            <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-2 gap-2 text-[11px] font-semibold text-emerald-100 relative z-10">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>PWA Field Tech App</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Live Quotations & PDF</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>SMS & WhatsApp Notify</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Reports & Analytics</span>
              </div>
            </div>
          </div>

          {/* Right Form Section (Modern Clean White Card) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white">
            <div>
              {/* Form Header */}
              <div className="mb-6">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#16A34A] bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 inline-block mb-2">
                  Secure Access Portal
                </span>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Sign in to your Account
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Enter your credentials below to access company administration or the technician dispatch app.
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-semibold flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    Username or Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. admin@coolair.lk or ruwan@coolair.lk"
                      className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] outline-hidden font-semibold bg-slate-50/70 focus:bg-white transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    Account Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-3 text-xs sm:text-sm rounded-2xl border border-slate-200 focus:ring-2 focus:ring-[#22C55E] focus:border-[#22C55E] outline-hidden font-semibold bg-slate-50/70 focus:bg-white transition-all shadow-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#22C55E] via-[#16A34A] to-[#15803D] hover:from-[#16a34a] hover:to-[#14532d] text-white font-black rounded-2xl shadow-lg shadow-emerald-600/25 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Fast One-Click Demo Logins */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Instant Demo Accounts
                  </p>
                  <span className="text-[10px] font-bold text-[#16A34A] bg-emerald-50 px-2 py-0.5 rounded-full">
                    Click to Fill
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Company Admin CoolAir */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('admin@coolair.lk', 'password123')}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 group-hover:text-emerald-700">
                        <Building className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                        <span>CoolAir Admin</span>
                      </div>
                      <span className="text-[9px] font-black bg-emerald-600 text-white px-1.5 py-0.5 rounded-full uppercase">
                        Admin
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 truncate">admin@coolair.lk</p>
                  </button>

                  {/* Technician Ruwan */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('ruwan@coolair.lk', 'password123')}
                    className="p-3 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-200 text-left transition-all cursor-pointer group shadow-2xs ring-1 ring-emerald-500/20"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                        <Wrench className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                        <span>Tech Ruwan</span>
                      </div>
                      <span className="text-[9px] font-black bg-[#F59E0B] text-slate-900 px-1.5 py-0.5 rounded-full uppercase">
                        PWA App
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-emerald-800 truncate">ruwan@coolair.lk</p>
                  </button>

                  {/* Technician Kasun */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('kasun@coolair.lk', 'password123')}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 group-hover:text-emerald-700">
                        <Wrench className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Tech Kasun</span>
                      </div>
                      <span className="text-[9px] font-black bg-sky-600 text-white px-1.5 py-0.5 rounded-full uppercase">
                        PWA App
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 truncate">kasun@coolair.lk</p>
                  </button>

                  {/* Super Admin */}
                  <button
                    type="button"
                    onClick={() => setDemoCredentials('superadmin@acpro.com', 'superadmin123')}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 text-left transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 group-hover:text-purple-700">
                        <Shield className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Super Admin</span>
                      </div>
                      <span className="text-[9px] font-black bg-purple-600 text-white px-1.5 py-0.5 rounded-full uppercase">
                        Master
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 truncate">superadmin@acpro.com</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span>© 2026 AC-Pro SaaS Enterprise</span>
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
