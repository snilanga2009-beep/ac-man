import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  ExternalLink
} from 'lucide-react';

export default function CompanyAdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'COMPANY_ADMIN' || user.role === 'SUPER_ADMIN') {
        navigate('/company/dashboard', { replace: true });
      } else if (user.role === 'TECHNICIAN') {
        // If already logged in as technician, redirect to technician pwa
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
        // Role mismatch: This is strictly Company Admin login
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
          'Invalid administrator username/email or password. Please try again.'
      );
    }
  };

  const fillAdminDemo = () => {
    setUsername('admin@coolair.lk');
    setPassword('password123');
    setError('');
  };

  const features = [
    {
      icon: <BarChart3 className="w-5 h-5 text-emerald-400" />,
      title: 'Real-Time Revenue Analytics',
      desc: 'Instant Daily, Weekly, and Monthly technician earnings & job ledger'
    },
    {
      icon: <Wrench className="w-5 h-5 text-emerald-400" />,
      title: 'Technician Dispatch & Tracking',
      desc: 'Seamless field job scheduling, QR check-ins, and performance matrices'
    },
    {
      icon: <FileText className="w-5 h-5 text-emerald-400" />,
      title: 'Automated Quotations & Invoices',
      desc: 'Generate professional A4 PDF estimates with instant WhatsApp sharing'
    },
    {
      icon: <Bell className="w-5 h-5 text-emerald-400" />,
      title: 'Automated Reminder Engine',
      desc: 'Automated SMS & WhatsApp alerts for upcoming and overdue AC servicing'
    }
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans overflow-x-hidden">
      {/* 1. HIGH RESOLUTION BACKGROUND IMAGE WITH DARK GRADIENT OVERLAY */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 -z-20 scale-105"
        style={{
          backgroundImage: `url('/images/company-admin-bg.jpg')`
        }}
      />

      {/* Dark tint & frosted glass gradient backdrop */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950/85 via-slate-900/80 to-emerald-950/75 backdrop-blur-[2px] -z-10" />

      {/* Subtle dynamic glow orbs */}
      <div className="fixed top-10 left-10 w-96 h-96 bg-[#22C55E]/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 2. MAIN ADMIN LOGIN CONTAINER */}
      <div className="w-full max-w-5xl mx-auto my-auto">
        {/* Top Header Badge */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-emerald-300 text-xs font-black shadow-lg">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>AC-Pro Enterprise SaaS • Company Admin Gateway</span>
          </div>
        </div>

        {/* 2-Column Desktop Card / Stacked Mobile Card */}
        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl sm:rounded-4xl border border-white/15 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-white">
          {/* LEFT COLUMN: BRANDING & ENTERPRISE OVERVIEW (Hidden on small mobile, visible on desktop) */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 bg-gradient-to-br from-emerald-950/80 via-slate-900/90 to-slate-950/90 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 relative overflow-hidden">
            {/* Background ambient pattern */}
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#22C55E]/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#16A34A] to-[#22C55E] flex items-center justify-center font-black text-white shadow-lg shadow-emerald-600/30">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">AC-Pro SaaS</h1>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                    Company Administration
                  </span>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 space-y-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20 inline-block">
                  🏢 Exclusive Company Admin Portal
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  Complete Control Over Your AC Service Operations
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                  Secure administration suite for HVAC company owners and service managers. Monitor operations, technician performance, quotations, and financial growth in real time.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3.5 mt-6 sm:mt-8">
                {features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 backdrop-blur-xs hover:bg-white/10 transition-colors"
                  >
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
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
                <Lock className="w-3.5 h-3.5 text-emerald-400" /> 256-Bit SSL Encrypted Admin Access
              </span>
              <span className="text-emerald-400 font-bold">CoolAir Sri Lanka</span>
            </div>
          </div>

          {/* RIGHT COLUMN: LOGIN FORM (Strictly for Company Admin) */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-slate-900/60">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Admin Sign In</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter your authorized company administrator credentials
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Quick 1-Click Demo Credentials (Admin Only) */}
              <div className="mt-5 p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Quick Demo Admin Access
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">1-Click Autofill</span>
                </div>
                <button
                  type="button"
                  onClick={fillAdminDemo}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-400" />
                    <span>admin@coolair.lk</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[10px] font-bold">
                    Use Admin Demo
                  </span>
                </button>
              </div>

              {/* FORM */}
              <form onSubmit={handleAdminLogin} className="mt-5 space-y-4">
                {/* Username / Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Admin Username or Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. admin@coolair.lk"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-semibold focus:border-emerald-500 focus:bg-white/10 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Password
                    </label>
                    <span className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
                      Forgot Password?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter administrator password"
                      className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-semibold focus:border-emerald-500 focus:bg-white/10 outline-none transition-all"
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
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#22C55E] via-[#16A34A] to-[#15803D] hover:opacity-95 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 mt-2"
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
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-[11px] text-slate-400">
                Are you a Company or Freelance Field Technician?{' '}
                <Link
                  to="/technician/login"
                  className="text-emerald-400 hover:text-emerald-300 font-bold underline underline-offset-2 ml-1"
                >
                  Technician OTP Login Portal &rarr;
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
