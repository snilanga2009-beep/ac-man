import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  CreditCard,
  Wrench,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Sparkles,
  RotateCw,
  Clock,
  Users,
  Smartphone,
  Check,
  Zap,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function CompanyBilling() {
  const [billing, setBilling] = useState(null);
  const [subData, setSubData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedMonths, setSelectedMonths] = useState(1);

  const fetchBillingData = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/company/billing'),
      axios.get('/api/company/subscription')
    ])
      .then(([billingRes, subRes]) => {
        setBilling(billingRes.data);
        setSubData(subRes.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load company billing/subscription:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleRenew = async (planId, months = 1) => {
    setRenewing(true);
    try {
      const res = await axios.post('/api/company/subscription/renew', {
        plan_id: planId,
        months: Number(months)
      });
      setToastMessage(`🎉 SaaS Subscription renewed successfully! Active until ${res.data.subscription?.end_date}.`);
      fetchBillingData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to renew subscription');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center w-full">
        <div className="animate-spin w-10 h-10 border-4 border-[#423A8E] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm font-bold text-slate-700">Loading SaaS Subscription & Licensing...</p>
      </div>
    );
  }

  const subscription = subData?.subscription || {
    plan_id: 'pro',
    plan_name: 'Professional Business',
    price: 12000,
    billing_cycle: 'Monthly',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    total_cycle_days: 30,
    current_day_in_cycle: 1,
    elapsed_days: 0,
    days_remaining: 30,
    progress_pct: 3,
    status: 'ACTIVE',
    is_expiring_soon: false,
    is_expired: false,
    auto_renew: 1,
    limits: { max_technicians: 10, max_ac_units: 500, whatsapp_api: true }
  };

  const availablePackages = subData?.available_packages || [
    {
      id: 'starter',
      name: 'Starter Cloud',
      price: 5000,
      billing_cycle: 'Monthly',
      limits: { max_technicians: 3, max_ac_units: 100, sms_provider: 'Text.lk SMS' },
      features: ['3 Field Tech Accounts', '100 Active AC Units', 'Text.lk SMS Gateway', 'Technician PWA Mobile App', 'Standard QR Code Tagging']
    },
    {
      id: 'pro',
      name: 'Professional Business',
      price: 12000,
      billing_cycle: 'Monthly',
      limits: { max_technicians: 10, max_ac_units: 500, whatsapp_api: true },
      features: ['10 Field Tech Accounts', '500 Active AC Units', 'WhatsApp Cloud API + SMS', 'Full QR Generator & Stickers', 'Automated Service Reminders', 'Priority Technical Support']
    },
    {
      id: 'enterprise',
      name: 'Ultimate Enterprise',
      price: 25000,
      billing_cycle: 'Monthly',
      limits: { max_technicians: 999, max_ac_units: 99999, dedicated_keys: true },
      features: ['Unlimited Tech Accounts', 'Unlimited AC Units', 'Dedicated Meta WhatsApp Keys', 'Multi-Branch Support', 'Live Operations Dispatcher', 'Custom Company White-labeling']
    }
  ];

  const isSuspended = subscription.status === 'SUSPENDED';

  return (
    <div className="w-full space-y-6 pb-12 font-sans text-slate-800">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="w-full p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span className="text-xs font-bold tracking-wide">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-white/80 hover:text-white text-xs font-bold px-2.5 py-1 bg-white/20 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <CreditCard className="w-6 h-6 text-[#423A8E]" />
            <span>SaaS Subscription & Licensing Overview</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your subscription tier, track 1 to 31 day cycle progress, and review active field technician licensing.
          </p>
        </div>
      </div>

      {/* 1. ACTIVE SAAS SUBSCRIPTION HERO & 1-TO-31 DAY PROGRESS BAR */}
      <div className="bg-gradient-to-br from-[#423A8E] via-[#31276d] to-[#1a1442] text-white p-6 sm:p-8 rounded-3xl border border-[#423A8E]/40 shadow-xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00CCCD]/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00CCCD] text-slate-950 flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3 h-3" />
                ACTIVE PACKAGE: {subscription.plan_id?.toUpperCase()}
              </span>
              
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isSuspended
                  ? 'bg-rose-500 text-white'
                  : subscription.is_expired
                  ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                  : subscription.is_expiring_soon
                  ? 'bg-amber-400/30 text-amber-200 border border-amber-400/40'
                  : 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40'
              }`}>
                {isSuspended ? '● DISABLED / PAUSED' : subscription.is_expired ? '● EXPIRED' : subscription.is_expiring_soon ? '● EXPIRES SOON' : '● ACTIVE SUBSCRIPTION'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>{subscription.plan_name}</span>
            </h2>

            <p className="text-xs text-slate-300">
              Billing Period: <strong>{subscription.start_date}</strong> to <strong>{subscription.end_date}</strong> ({subscription.total_cycle_days} Total Cycle Days)
            </p>
          </div>

          {/* Pricing & Actions */}
          <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 text-left md:text-right shrink-0 w-full md:w-auto space-y-3">
            <div>
              <span className="text-[10px] text-slate-300 uppercase font-black tracking-wider block">Monthly Package Price</span>
              <div className="text-3xl font-black text-[#00CCCD] font-mono mt-0.5">
                Rs. {subscription.price?.toLocaleString()}
                <span className="text-xs font-normal text-slate-300 ml-1">/ Month</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRenew(subscription.plan_id, selectedMonths)}
                disabled={renewing}
                className="w-full px-5 py-2.5 bg-gradient-to-r from-[#00CCCD] to-teal-400 hover:brightness-105 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-[#00CCCD]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RotateCw className={`w-4 h-4 ${renewing ? 'animate-spin' : ''}`} />
                <span>{renewing ? 'Processing...' : `Re-new 1-Month (Rs. ${subscription.price?.toLocaleString()})`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1-TO-31 DAY TIME COUNTER & PROGRESS BAR */}
        <div className="relative z-10 bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/15 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                Monthly 1 to 31 Day Cycle Counter:
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#00CCCD]/25 text-[#00CCCD] font-mono font-black text-xs border border-[#00CCCD]/30">
                Day {subscription.current_day_in_cycle} of {subscription.total_cycle_days} Days
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span className={`font-black font-mono ${
                subscription.is_expired
                  ? 'text-rose-400'
                  : subscription.is_expiring_soon
                  ? 'text-amber-300'
                  : 'text-emerald-300'
              }`}>
                {subscription.is_expired
                  ? 'Subscription Expired'
                  : `${subscription.days_remaining} Day${subscription.days_remaining === 1 ? '' : 's'} Left Until Expiration`}
              </span>
              <span className="text-slate-400 text-[11px]">
                ({subscription.progress_pct}% elapsed)
              </span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-900/70 h-4 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  subscription.is_expired
                    ? 'bg-rose-500'
                    : subscription.is_expiring_soon
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                    : 'bg-gradient-to-r from-[#00CCCD] via-teal-400 to-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, subscription.progress_pct))}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5 px-1">
              <span>Day 1 (Cycle Start: {subscription.start_date})</span>
              <span className="hidden sm:inline text-slate-500">Day 15 (Mid-Cycle Checkpoint)</span>
              <span>Day {subscription.total_cycle_days} (Cycle End: {subscription.end_date})</span>
            </div>
          </div>

          {/* Quick Limits Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/10 text-xs">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Users className="w-3.5 h-3.5 text-[#00CCCD]" />
              <span>Max Techs: <strong>{subscription.limits?.max_technicians === 999 ? 'Unlimited' : (subscription.limits?.max_technicians || 10)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Wrench className="w-3.5 h-3.5 text-[#00CCCD]" />
              <span>Max Units: <strong>{subscription.limits?.max_ac_units === 99999 ? 'Unlimited' : (subscription.limits?.max_ac_units || 500)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp Cloud: <strong>{subscription.limits?.whatsapp_api ? 'Enabled' : 'SMS'}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Shield className="w-3.5 h-3.5 text-amber-300" />
              <span>Auto-Renew: <strong>{subscription.auto_renew ? 'Active' : 'Manual'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TECHNICIAN SEAT LICENSING TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/70">
          <div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Enrolled Field Technician Fleet ({billing?.active_technicians || 0} Technicians)
            </h3>
            <p className="text-[11px] text-slate-500">
              One-time activation fee per technician seat: Rs. {(billing?.technician_price || 2000).toLocaleString()}
            </p>
          </div>
          <div className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs">
            Status: {billing?.payment_status || 'PAID'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-500 font-black uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-4">Technician Name & Email</th>
                <th className="p-4">Mobile Number</th>
                <th className="p-4">Status</th>
                <th className="p-4">Seat Activation Fee</th>
                <th className="p-4">Billing Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(billing?.technicians || []).map(t => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-900">
                    <div>{t.name}</div>
                    <div className="text-[11px] font-normal text-slate-400">{t.email}</div>
                  </td>
                  <td className="p-4 text-slate-700 font-mono">{t.mobile || 'N/A'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                      t.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (t.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4 font-black text-slate-800 font-mono">
                    Rs. {(billing?.technician_price || 2000).toLocaleString()}
                  </td>
                  <td className="p-4 font-black text-emerald-700 text-[11px]">
                    ONE-TIME ACTIVATION FEE
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
