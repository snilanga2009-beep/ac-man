import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sliders,
  DollarSign,
  Save,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Layers,
  Users,
  Wrench,
  Smartphone,
  Shield,
  RotateCw,
  Plus,
  Trash2,
  Edit3
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function SaasPricingSettings() {
  const [techPrice, setTechPrice] = useState(2000);
  const [packages, setPackages] = useState([
    {
      id: 'custom_1',
      name: 'Custom Package 1',
      subtitle: 'Standard Operations Tier',
      price: 6000,
      billing_cycle: 'Monthly',
      limits: { max_technicians: 5, max_ac_units: 250, whatsapp_api: true },
      features: ['Up to 5 Field Technicians', '250 Registered AC Units', 'Direct SMS & WhatsApp Alerts', 'Technician Mobile PWA App', 'Automated Service Reminders', 'Standard Support']
    },
    {
      id: 'custom_2',
      name: 'Custom Package 2',
      subtitle: 'Advanced Enterprise Tier',
      price: 15000,
      billing_cycle: 'Monthly',
      limits: { max_technicians: 20, max_ac_units: 1000, whatsapp_api: true },
      features: ['Up to 20 Field Technicians', '1,000 Registered AC Units', 'Full WhatsApp Business Cloud API', 'Instant QR Code Tagging & Stickers', 'Live Route & Job Dispatcher', 'Priority 24/7 Support']
    }
  ]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [savingPackages, setSavingPackages] = useState(false);
  const { refreshSession } = useAuth();

  const fetchSettings = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/super-admin/settings/pricing'),
      axios.get('/api/super-admin/subscriptions/plans').catch(() => ({ data: null }))
    ])
      .then(([pricingRes, plansRes]) => {
        setTechPrice(pricingRes.data.default_technician_price || 2000);
        if (plansRes.data?.packages && Array.isArray(plansRes.data.packages) && plansRes.data.packages.length > 0) {
          setPackages(plansRes.data.packages);
        } else if (Array.isArray(plansRes.data) && plansRes.data.length > 0) {
          setPackages(plansRes.data);
        } else if (plansRes.data?.plans && typeof plansRes.data.plans === 'object') {
          const list = Object.values(plansRes.data.plans).filter(p => p && p.id);
          if (list.length > 0) setPackages(list);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load SaaS pricing settings:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveTechPrice = async (e) => {
    e.preventDefault();
    setSaveSuccess('');
    try {
      await axios.put('/api/super-admin/settings/pricing', {
        default_technician_price: parseFloat(techPrice)
      });
      setSaveSuccess('Technician one-time seat activation fee updated successfully!');
      refreshSession();
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      alert('Failed to update pricing');
    }
  };

  const handlePackageFieldChange = (pkgId, field, value) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, [field]: value } : p));
  };

  const handlePackageLimitChange = (pkgId, field, value) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? {
      ...p,
      limits: { ...p.limits, [field]: value }
    } : p));
  };

  const handleAddFeature = (pkgId) => {
    const feat = prompt('Enter new package feature description:');
    if (!feat || !feat.trim()) return;
    setPackages(prev => prev.map(p => p.id === pkgId ? {
      ...p,
      features: [...(p.features || []), feat.trim()]
    } : p));
  };

  const handleRemoveFeature = (pkgId, featIndex) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? {
      ...p,
      features: (p.features || []).filter((_, i) => i !== featIndex)
    } : p));
  };

  const handleAddNewCustomPackage = () => {
    const pkgId = `custom_${Date.now()}`;
    const newPkg = {
      id: pkgId,
      name: 'Custom VIP Tier',
      price: 18000,
      billing_cycle: 'Monthly',
      limits: { max_technicians: 20, max_ac_units: 1000, whatsapp_api: true },
      features: ['20 Field Tech Accounts', '1,000 Active AC Units', 'WhatsApp Cloud API Enabled', 'Priority Live Dispatch']
    };
    setPackages([...packages, newPkg]);
  };

  const handleDeletePackage = (pkgId) => {
    if (['starter', 'pro', 'enterprise'].includes(pkgId)) {
      if (!confirm('Are you sure you want to delete this default package tier?')) return;
    }
    setPackages(packages.filter(p => p.id !== pkgId));
  };

  const handleSavePackages = async (e) => {
    e.preventDefault();
    setSavingPackages(true);
    setSaveSuccess('');
    try {
      const res = await axios.put('/api/super-admin/subscriptions/plans', { packages });
      if (res.data?.packages && Array.isArray(res.data.packages)) {
        setPackages(res.data.packages);
      }
      setSaveSuccess('All Custom SaaS Subscription Packages saved and published successfully!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save subscription plans');
    } finally {
      setSavingPackages(false);
    }
  };

  if (loading) return <div className="p-8 text-xs text-slate-400">Loading SaaS Pricing & Subscription Settings...</div>;

  return (
    <div className="max-w-6xl space-y-8 font-sans pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-[#423A8E]" />
          <span>SaaS Subscription Packages & Tenant Pricing Control</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Add, customize, and edit custom SaaS subscription packages, configure limits (technicians & AC units), and set technician seat fees.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs font-bold">{saveSuccess}</span>
        </div>
      )}

      {/* 1. SAAS SUBSCRIPTION PACKAGES & CUSTOM TIERS EDITOR */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#423A8E]" />
              <span>SaaS Subscription Packages ({packages.length} Active Tiers)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Customize package names, monthly subscription prices, technician caps, and custom feature tags.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddNewCustomPackage}
            className="px-3.5 py-2 bg-[#00CCCD] hover:bg-[#00b3b4] text-slate-950 rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Custom Package</span>
          </button>
        </div>

        <form onSubmit={handleSavePackages} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {packages.map(pkg => (
              <div
                key={pkg.id}
                className="bg-slate-50/90 rounded-3xl p-5 border border-slate-200/90 space-y-4 flex flex-col justify-between shadow-xs relative"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                      ID: {pkg.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePackage(pkg.id)}
                      title="Delete Package"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Package Name *</label>
                    <input
                      type="text"
                      required
                      value={pkg.name}
                      onChange={(e) => handlePackageFieldChange(pkg.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-black text-slate-900 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#423A8E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Monthly Price (LKR) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
                        LKR
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        required
                        value={pkg.price}
                        onChange={(e) => handlePackageFieldChange(pkg.id, 'price', Number(e.target.value))}
                        className="w-full pl-12 pr-3 py-2 text-base font-black text-[#423A8E] rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-[#423A8E] outline-hidden font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Max Techs</label>
                      <input
                        type="number"
                        min="1"
                        value={pkg.limits?.max_technicians || 10}
                        onChange={(e) => handlePackageLimitChange(pkg.id, 'max_technicians', Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Max AC Units</label>
                      <input
                        type="number"
                        min="10"
                        value={pkg.limits?.max_ac_units || 500}
                        onChange={(e) => handlePackageLimitChange(pkg.id, 'max_ac_units', Number(e.target.value))}
                        className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(pkg.limits?.whatsapp_api)}
                        onChange={(e) => handlePackageLimitChange(pkg.id, 'whatsapp_api', e.target.checked)}
                        className="rounded-md border-slate-300 text-[#423A8E] focus:ring-[#423A8E]"
                      />
                      <span>WhatsApp Cloud API Enabled</span>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Features:</span>
                      <button
                        type="button"
                        onClick={() => handleAddFeature(pkg.id)}
                        className="text-[10px] font-black text-[#423A8E] hover:underline cursor-pointer"
                      >
                        + Add Feature
                      </button>
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 max-h-32 overflow-y-auto">
                      {(pkg.features || []).map((f, i) => (
                        <div key={i} className="flex items-center justify-between gap-1 group bg-white/60 p-1 rounded-md">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#423A8E] shrink-0"></span>
                            <span className="truncate">{f}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature(pkg.id, i)}
                            className="text-slate-300 hover:text-rose-500 text-xs px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={savingPackages}
              className="px-6 py-2.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-black shadow-lg shadow-[#423A8E]/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingPackages ? 'Saving Packages...' : 'Save All SaaS Packages'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. TECHNICIAN ONE-TIME FEE CONFIGURATION */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <span>Technician One-Time Seat Activation Fee</span>
          </h2>
          <p className="text-xs text-slate-500">
            One-time licensing fee charged when an AC Company adds a new field technician seat.
          </p>
        </div>

        <form onSubmit={handleSaveTechPrice} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              One-Time Price Per Technician Seat (LKR) *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">
                LKR
              </span>
              <input
                type="number"
                min="0"
                step="100"
                required
                value={techPrice}
                onChange={(e) => setTechPrice(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 text-base font-black text-slate-800 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-hidden font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Standard one-time activation charge: <strong>LKR 2,000</strong>.
            </p>
          </div>

          <div className="pt-2 flex justify-start">
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save Technician Fee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
