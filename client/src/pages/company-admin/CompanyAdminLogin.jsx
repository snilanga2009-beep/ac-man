import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Wrench,
  FileText,
  Bell,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  Layers,
  Zap,
  Star
} from 'lucide-react';

export default function CompanyAdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyBranding, setCompanyBranding] = useState({ name: 'AC-Pro HVAC Enterprise', logo: null });
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch custom company branding/logo
    axios.get('/api/auth/company-branding')
      .then(res => {
        if (res.data?.company) {
          setCompanyBranding(res.data.company);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') {
        navigate('/company/dashboard', { replace: true });
      } else if (user.role === 'TECHNICIAN') {
        navigate('/technician/pwa', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loggedUser = await login(username, password);
      setLoading(false);

      if (loggedUser.role === 'TECHNICIAN') {
        if (logout) logout();
        setError('Access Restricted: This portal is exclusively for Company Administrators. Technicians must log in through the Technician Field Portal.');
        return;
      }

      if (loggedUser.role === 'SUPER_ADMIN') {
        navigate('/super-admin/dashboard');
      } else {
        navigate('/company/dashboard');
      }
    } catch (err) {
      setLoading(false);
      setError(
        err.response?.data?.error ||
          'Invalid administrator username/email or password. Please verify credentials.'
      );
    }
  };

  const features = [
    {
      icon: <BarChart3 className="w-5 h-5 text-cyan-400" />,
      title: 'Real-Time Revenue Analytics',
      desc: 'Instant daily, monthly cash flow and technician performance ledgers'
    },
    {
      icon: <Wrench className="w-5 h-5 text-emerald-400" />,
      title: 'Technician Dispatch & Tracking',
      desc: 'Seamless job dispatching, QR check-ins, and Sri Lankan district coverage'
    },
    {
      icon: <FileText className="w-5 h-5 text-violet-400" />,
      title: 'Automated Invoices & Quotations',
      desc: 'Branded email dispatch via Gmail/SMTP and instant WhatsApp delivery'
    },
    {
      icon: <Bell className="w-5 h-5 text-amber-400" />,
      title: 'Automated Reminder Engine',
      desc: '30-day, 90-day, and 180-day automated customer maintenance schedules'
    }
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans overflow-x-hidden">
      {/* 1. DYNAMIC HIGH-RES BACKGROUND WITH COLORFUL GRADIENT BACKDROP */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 -z-20 scale-105"
        style={{
          backgroundImage: `url('/images/company-admin-bg.jpg')`
        }}
      />

      {/* Colorful frosted glass gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-indigo-950/80 backdrop-blur-[3px] -z-10" />

      {/* Ambient dynamic multi-color glowing orbs */}
      <div className="fixed top-12 left-12 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="fixed bottom-12 right-12 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/2 left-1/3 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 2. MAIN CONTAINER */}
      <div className="w-full max-w-5xl mx-auto my-auto relative z-10">
        {/* Top Header Badge */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-purple-500/20 backdrop-blur-md border border-white/20 text-cyan-300 text-xs font-black shadow-xl">
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>AC-Pro Enterprise SaaS • Verified Company Admin Portal</span>
          </div>
        </div>

        {/* 2-Column Desktop Card / Stacked Mobile Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl sm:rounded-4xl border border-white/15 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-white">
          {/* LEFT COLUMN: BRANDING, LOGO & ENTERPRISE OVERVIEW */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-slate-950/95 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
            {/* Ambient lighting highlight */}
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />

            <div>
              {/* Custom Company Logo Display */}
              <div className="flex items-center gap-3.5">
                {companyBranding.logo ? (
                  <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-xl shadow-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={companyBranding.logo}
                      alt={companyBranding.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-500 to-emerald-500 flex items-center justify-center font-black text-white shadow-xl shadow-cyan-500/30 shrink-0 border border-white/20">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5">
                    {companyBranding.name || 'AC-Pro HVAC Platform'}
                  </h1>
                  <span className="text-[11px] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-300 to-teal-200 block">
                    Enterprise Company Administration
                  </span>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 space-y-2">
                <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider border border-cyan-500/30 inline-block shadow-sm">
                  🏢 Tenant Administration Suite
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Centralized Operations, Billing & Field Management
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                  Manage technician dispatching, customer service history, automated reminders, and instant email & WhatsApp invoice delivery in one modern unified platform.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5 mt-6 sm:mt-8">
                {features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 backdrop-blur-xs hover:bg-white/10 hover:border-white/20 transition-all shadow-sm"
                  >
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                      {feat.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate">{feat.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Security Assurance */}
            <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5 text-cyan-400" /> 256-Bit SSL Encrypted Admin Access
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Active SaaS Tenant
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: LOGIN FORM (Demo box removed completely) */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-slate-900/70 relative">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Company Sign In</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter authorized company administrator credentials
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-emerald-500/20 to-indigo-500/20 border border-white/15 flex items-center justify-center text-cyan-400 shadow-md shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mt-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* FORM */}
              <form onSubmit={handleAdminLogin} className="mt-6 space-y-4">
                {/* Username / Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Admin Username or Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="admin@yourcompany.lk"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-semibold focus:border-cyan-400 focus:bg-white/10 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Password *
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full pl-10 pr-11 py-3.5 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-semibold focus:border-emerald-400 focus:bg-white/10 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50 mt-6"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Company Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Note & Link to Technician OTP App Login */}
            <div className="mt-8 pt-4 border-t border-white/10 text-center">
              <p className="text-[11px] text-slate-400">
                Are you a Company or Freelance Field Technician?{' '}
                <Link
                  to="/technician/login"
                  className="text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-2 ml-1"
                >
                  Technician Login Portal &rarr;
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
