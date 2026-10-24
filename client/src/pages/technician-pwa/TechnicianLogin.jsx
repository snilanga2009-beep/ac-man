import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
  Smartphone,
  Wrench,
  ShieldCheck,
  KeyRound,
  Lock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Phone,
  UserCheck,
  Sparkles,
  QrCode,
  DollarSign,
  Eye,
  EyeOff
} from 'lucide-react';

export default function TechnicianLogin() {
  const { user, login, requestTechnicianOtp, verifyTechnicianOtp, logout } = useAuth();
  const navigate = useNavigate();

  const [loginMode, setLoginMode] = useState('OTP'); // 'OTP' | 'PASSWORD'
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('SMS_WHATSAPP');
  const [otpStep, setOtpStep] = useState('REQUEST'); // 'REQUEST' | 'VERIFY'
  const [otpCode, setOtpCode] = useState('');
  const [otpMeta, setOtpMeta] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [techAccounts, setTechAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user) {
      if (user.role === 'TECHNICIAN' || user.role === 'FREELANCE_TECHNICIAN') {
        navigate('/technician/pwa', { replace: true });
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    axios
      .get('/api/auth/technician/accounts-preview')
      .then(res => setTechAccounts(res.data?.accounts || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleRequestOtp = async e => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!identifier.trim()) {
      setError('Please enter your Mobile Number, Technician ID (FT-0001 / CT-0002), or Username.');
      return;
    }

    setLoading(true);
    try {
      const data = await requestTechnicianOtp(identifier, channel);
      setOtpMeta(data);
      setOtpStep('VERIFY');
      setCountdown(60);
      if (data.otp_code) {
        setOtpCode(String(data.otp_code));
      }
      setSuccessMsg(data.message || 'One-Time OTP code sent to your mobile/WhatsApp!');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send OTP code. Please verify your mobile number or Technician ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async e => {
    e.preventDefault();
    setError('');
    if (!otpCode || String(otpCode).trim().length < 4) {
      setError('Please enter the 6-digit One-Time OTP code.');
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await verifyTechnicianOtp(identifier, otpCode);
      if (loggedUser.role !== 'TECHNICIAN' && loggedUser.role !== 'FREELANCE_TECHNICIAN') {
        if (logout) logout();
        setError('This portal is exclusively for Company & Freelance Technicians.');
        setLoading(false);
        return;
      }
      navigate('/technician/pwa', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP code. Please try again.');
      setLoading(false);
    }
  };

  const handlePasswordLogin = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(identifier, password);
      if (loggedUser.role !== 'TECHNICIAN' && loggedUser.role !== 'FREELANCE_TECHNICIAN') {
        if (logout) logout();
        setError('Access Restricted: This app login is exclusively for Company Technicians & Freelance Technicians.');
        setLoading(false);
        return;
      }
      navigate('/technician/pwa', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid technician credentials.');
      setLoading(false);
    }
  };

  const selectQuickTech = acc => {
    const idVal = acc.mobile || acc.username || acc.technician_code;
    setIdentifier(idVal);
    setPassword('password123');
    setError('');
    setSuccessMsg(`Selected ${acc.name} (${acc.technician_code} • ${acc.technician_type === 'FREELANCE' ? 'Freelance Tech' : 'Company Tech'})`);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-6 font-sans overflow-x-hidden">
      {/* Background image + gradient overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat -z-20 scale-105"
        style={{ backgroundImage: `url('/images/company-admin-bg.jpg')` }}
      />
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950/90 via-indigo-950/85 to-teal-950/85 backdrop-blur-[2px] -z-10" />

      <div className="w-full max-w-4xl mx-auto my-auto">
        {/* Top Badge */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[#00CCCD] text-xs font-black shadow-lg">
            <Smartphone className="w-4 h-4 text-[#00CCCD]" />
            <span>AC-Pro Field Technician Mobile & PWA Portal</span>
          </div>
        </div>

        <div className="bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 text-white">
          {/* LEFT PANEL: TECHNICIAN APP INFO */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-gradient-to-br from-[#423A8E]/90 via-slate-900/95 to-slate-950 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#00CCCD] text-slate-950 flex items-center justify-center font-black shadow-lg">
                  <Wrench className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">Technician App</h1>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#00CCCD] block">
                    Company & Freelance Techs
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-[10px] font-black">
                    Freelance Technicians (FT)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-[10px] font-black">
                    Company Technicians (CT)
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white leading-tight pt-1">
                  Instant One-Time OTP Field Login
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Sign in with a 6-digit One-Time OTP sent to your registered Mobile or WhatsApp number—or use your password.
                </p>
              </div>

              <div className="space-y-2.5 mt-6 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <KeyRound className="w-5 h-5 text-[#00CCCD] shrink-0" />
                  <div>
                    <p className="font-black text-white">One-Time OTP via SMS & WhatsApp</p>
                    <p className="text-[11px] text-slate-400">Fast passwordless sign-in on mobile devices</p>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-black text-white">Accept Job Offers & Track Earnings</p>
                    <p className="text-[11px] text-slate-400">View your agreed technician fee & payout balance</p>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-black text-white">QR Equipment Scan & Job Checklist</p>
                    <p className="text-[11px] text-slate-400">Start/finish jobs, upload photos & request extras</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <Link to="/company/login" className="hover:text-white underline font-semibold">
                Company Admin Login →
              </Link>
              <Link to="/login" className="hover:text-white underline font-semibold">
                Main Portal
              </Link>
            </div>
          </div>

          {/* RIGHT PANEL: OTP & PASSWORD LOGIN FORM */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-slate-900/60">
            <div>
              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/5 border border-white/10 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('OTP');
                    setError('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMode === 'OTP'
                      ? 'bg-[#00CCCD] text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                  <span>One-Time OTP Login</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('PASSWORD');
                    setError('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    loginMode === 'PASSWORD'
                      ? 'bg-[#00CCCD] text-slate-950 shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Password Login</span>
                </button>
              </div>

              {/* Quick 1-Click Technician Selector (Both Company Tech + Freelance Tech) */}
              {techAccounts.length > 0 && (
                <div className="mb-4 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#00CCCD] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Quick Select Technician (Company & Freelance)
                    </span>
                    <span className="text-[10px] text-slate-400">1-Click Fill</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                    {techAccounts.map(acc => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => selectQuickTech(acc)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-left flex items-center justify-between gap-2 transition-all cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white truncate">{acc.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {acc.mobile || acc.username} • {acc.technician_code}
                          </p>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                            acc.technician_type === 'FREELANCE'
                              ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30'
                              : 'bg-teal-500/30 text-teal-200 border border-teal-400/30'
                          }`}
                        >
                          {acc.technician_type === 'FREELANCE' ? 'Freelance' : 'Company'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error / Success Alerts */}
              {error && (
                <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && !error && (
                <div className="mb-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* MODE 1: ONE-TIME OTP LOGIN */}
              {loginMode === 'OTP' && (
                <>
                  {otpStep === 'REQUEST' ? (
                    <form onSubmit={handleRequestOtp} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Mobile / WhatsApp Number, Technician ID (FT/CT), or Username *
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={identifier}
                            onChange={e => setIdentifier(e.target.value)}
                            placeholder="e.g. 0773334444 or FT-0001 or kasun_tech"
                            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-bold focus:border-[#00CCCD] focus:bg-white/10 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Receive One-Time OTP Via
                        </label>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {[
                            { id: 'SMS_WHATSAPP', label: 'SMS + WhatsApp' },
                            { id: 'SMS', label: 'SMS Only' },
                            { id: 'WHATSAPP', label: 'WhatsApp Only' }
                          ].map(ch => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => setChannel(ch.id)}
                              className={`py-2 px-2.5 rounded-xl font-bold border text-[11px] cursor-pointer transition-all ${
                                channel === ch.id
                                  ? 'bg-indigo-600/40 border-[#00CCCD] text-white'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                              }`}
                            >
                              {ch.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-5 rounded-2xl bg-[#00CCCD] hover:brightness-105 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4" />
                            <span>Send One-Time OTP Code</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      {/* Verified Technician Identity Card */}
                      {otpMeta?.technician && (
                        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 font-black">
                              <UserCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-white">{otpMeta.technician.name}</span>
                                <span className="px-2 py-0.5 rounded bg-[#00CCCD]/20 text-[#00CCCD] font-mono text-[10px] font-black">
                                  {otpMeta.technician.technician_code}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {otpMeta.technician.technician_type === 'FREELANCE'
                                  ? 'Freelance Technician'
                                  : 'Company Technician'}{' '}
                                • {otpMeta.technician.company_name}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOtpStep('REQUEST');
                              setOtpCode('');
                              setOtpMeta(null);
                            }}
                            className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      )}

                      {/* Instant OTP Code Display for Local/Demo Testing */}
                      {otpMeta?.otp_code && (
                        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                              One-Time OTP Code Received ({otpMeta.masked_phone})
                            </span>
                            <span className="text-lg font-mono font-black tracking-widest text-white">
                              {otpMeta.otp_code}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOtpCode(String(otpMeta.otp_code))}
                            className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
                          >
                            Auto-Fill OTP
                          </button>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Enter 6-Digit One-Time OTP Code *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="• • • • • •"
                          className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-[#00CCCD]/50 text-white text-center font-mono text-xl font-black tracking-[0.5em] focus:border-[#00CCCD] outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Sent to: {otpMeta?.masked_phone || identifier}</span>
                        {countdown > 0 ? (
                          <span>Resend available in {countdown}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRequestOtp}
                            className="text-[#00CCCD] font-bold hover:underline cursor-pointer"
                          >
                            Resend New OTP Code
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Verify OTP & Login to Technician App</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </>
              )}

              {/* MODE 2: PASSWORD LOGIN */}
              {loginMode === 'PASSWORD' && (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Mobile Number, Technician ID (FT/CT), Username, or Email *
                    </label>
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      placeholder="e.g. kasun_tech or 0773334444 or FT-0001"
                      className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-bold focus:border-[#00CCCD] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full pl-4 pr-10 py-3 rounded-2xl bg-white/5 border border-white/15 text-white placeholder-slate-500 text-xs sm:text-sm font-bold focus:border-[#00CCCD] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-5 rounded-2xl bg-[#00CCCD] hover:brightness-105 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Wrench className="w-4 h-4" />
                        <span>Sign In to Technician App</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-[11px] text-slate-400">
                Dedicated Technician Login URL:{' '}
                <code className="text-[#00CCCD] font-mono font-bold">/technician/login</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
