import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2,
  Plus,
  Users,
  Wrench,
  Shield,
  CheckCircle2,
  PauseCircle,
  MoreVertical,
  X,
  AlertCircle,
  Clock,
  Sparkles,
  RotateCw,
  Layers,
  ArrowRight,
  CreditCard,
  Trash2
} from 'lucide-react';

export default function CompaniesList() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [createError, setCreateError] = useState('');

  // Subscription Assignment State
  const [subForm, setSubForm] = useState({
    plan_id: 'pro',
    custom_plan_name: '',
    price: 12000,
    duration_months: 1,
    start_date: '',
    end_date: '',
    custom_max_technicians: 10,
    custom_max_units: 500,
    auto_renew: true,
    is_custom: false
  });

  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: '',
    owner_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    logo: '',
    registration_number: '',
    invoice_prefix: 'INV',
    currency: 'LKR',
    status: 'ACTIVE'
  });

  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    mobile: '',
    username: '',
    password: '',
    status: 'ACTIVE'
  });

  const [availablePlans, setAvailablePlans] = useState([]);

  const fetchCompanies = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/super-admin/companies'),
      axios.get('/api/super-admin/subscriptions/plans').catch(() => ({ data: null }))
    ])
      .then(([compRes, plansRes]) => {
        setCompanies(compRes.data || []);
        if (plansRes.data?.packages && Array.isArray(plansRes.data.packages)) {
          setAvailablePlans(plansRes.data.packages);
        } else if (Array.isArray(plansRes.data)) {
          setAvailablePlans(plansRes.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching companies:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setCreateError('');
    try {
      await axios.post('/api/super-admin/companies', companyForm);
      setIsCreateModalOpen(false);
      fetchCompanies();
      setCompanyForm({
        name: '', owner_name: '', phone: '', whatsapp: '', email: '',
        address: '', logo: '', registration_number: '', invoice_prefix: 'INV',
        currency: 'LKR', status: 'ACTIVE'
      });
      setToastMessage('Company created successfully with active Starter Cloud subscription!');
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Failed to create company');
    }
  };

  const handleDeleteCompany = async (comp) => {
    if (!window.confirm(`Are you SURE you want to permanently delete company "${comp.name}"?\n\nWARNING: This will permanently erase all associated technicians, customers, AC units, service jobs, quotations, and invoices.`)) {
      return;
    }
    try {
      await axios.delete(`/api/super-admin/companies/${comp.id}`);
      fetchCompanies();
      setToastMessage(`Company "${comp.name}" and all associated data deleted successfully.`);
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete company');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    try {
      await axios.post(`/api/super-admin/companies/${selectedCompany.id}/admin`, adminForm);
      setIsAdminModalOpen(false);
      fetchCompanies();
      setAdminForm({ name: '', email: '', mobile: '', username: '', password: '', status: 'ACTIVE' });
      setToastMessage(`Company Administrator created for ${selectedCompany.name}!`);
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create company admin');
    }
  };

  const openSubModal = (comp) => {
    setSelectedCompany(comp);
    const sub = comp.subscription || {};
    const planKey = (sub.plan_id || 'pro').toLowerCase();
    const isCustom = planKey === 'custom' || (!['starter', 'pro', 'enterprise'].includes(planKey) && !!sub.custom_plan_name);
    setSubForm({
      plan_id: sub.plan_id || 'pro',
      custom_plan_name: isCustom ? (sub.custom_plan_name || sub.plan_name || '') : '',
      price: sub.price || 12000,
      duration_months: 1,
      start_date: sub.start_date || new Date().toISOString().split('T')[0],
      end_date: sub.end_date || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      custom_max_technicians: sub.max_technicians || sub.limits?.max_technicians || 10,
      custom_max_units: sub.max_units || sub.limits?.max_ac_units || 500,
      auto_renew: !!sub.auto_renew,
      is_custom: isCustom
    });
    setIsSubModalOpen(true);
  };

  const handleAssignSubscription = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setSubscribing(true);
    try {
      await axios.put(`/api/super-admin/companies/${selectedCompany.id}/subscription`, {
        plan_id: subForm.is_custom ? 'CUSTOM' : subForm.plan_id,
        custom_plan_name: subForm.is_custom ? (subForm.custom_plan_name || 'Custom Package') : null,
        price: Number(subForm.price) || 0,
        start_date: subForm.start_date,
        end_date: subForm.end_date,
        custom_max_technicians: Number(subForm.custom_max_technicians) || null,
        custom_max_units: Number(subForm.custom_max_units) || null,
        auto_renew: subForm.auto_renew
      });
      setIsSubModalOpen(false);
      fetchCompanies();
      setToastMessage(`Custom subscription for ${selectedCompany.name} updated successfully!`);
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to assign subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const handleQuickRenew1Month = async (comp) => {
    try {
      await axios.post(`/api/super-admin/companies/${comp.id}/subscription/renew`, {
        months: 1,
        plan_id: comp.subscription?.plan_id || 'pro'
      });
      fetchCompanies();
      setToastMessage(`🎉 1-Month Renewal applied for ${comp.name}!`);
      setTimeout(() => setToastMessage(''), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to renew subscription');
    }
  };

  const toggleCompanyStatus = async (comp) => {
    const newStatus = comp.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to change status of ${comp.name} to ${newStatus}?`)) return;

    try {
      await axios.patch(`/api/super-admin/companies/${comp.id}/status`, { status: newStatus });
      fetchCompanies();
    } catch (err) {
      alert('Failed to update company status');
    }
  };

  return (
    <div className="space-y-6 font-sans pb-12">
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
            <Building2 className="w-6 h-6 text-[#423A8E]" />
            <span>AC Companies (Tenants) & SaaS Subscriptions</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage multi-tenant AC companies, assign 2 Custom SaaS packages, track 1 to 31 day month cycles, and configure renewal counters.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-black shadow-lg shadow-[#423A8E]/25 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create AC Company
        </button>
      </div>

      {/* Companies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {companies.map(comp => {
          const sub = comp.subscription || {
            plan_id: 'custom_1',
            plan_name: 'Custom Package 1',
            price: 6000,
            current_day_in_cycle: 1,
            total_cycle_days: 30,
            days_remaining: 30,
            progress_pct: 3,
            status: 'active',
            is_expiring_soon: false,
            is_expired: false,
            start_date: '2026-10-01',
            end_date: '2026-11-01'
          };

          return (
            <div key={comp.id} className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
              <div className="p-5 space-y-3.5">
                {/* Company Name & Tenant Status */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#423A8E]/10 text-[#423A8E] font-black flex items-center justify-center border border-[#423A8E]/20 text-sm">
                      {comp.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-slate-900">{comp.name}</h3>
                      <p className="text-[11px] text-slate-400 font-medium">{comp.owner_name || 'Owner N/A'}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                    comp.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {comp.status}
                  </span>
                </div>

                {/* SaaS Subscription Card with 1 to 31 Day Counter */}
                <div className="bg-gradient-to-br from-[#423A8E] to-[#261f5c] text-white p-3.5 rounded-2xl border border-[#423A8E]/40 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-[#00CCCD] text-slate-950 uppercase tracking-wider">
                      {sub.plan_id?.toUpperCase()} PLAN
                    </span>
                    <span className={`text-[10px] font-black font-mono ${
                      sub.is_expired ? 'text-rose-300' : sub.is_expiring_soon ? 'text-amber-300' : 'text-emerald-300'
                    }`}>
                      {sub.is_expired ? 'EXPIRED' : `${sub.days_remaining}d Left`}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-black text-white">{sub.plan_name}</span>
                    <span className="text-xs font-mono font-bold text-[#00CCCD]">
                      Rs. {sub.price?.toLocaleString()}/mo
                    </span>
                  </div>

                  {/* 1 to 31 Day Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                      <span>Day {sub.current_day_in_cycle} of {sub.total_cycle_days}</span>
                      <span>Expires: {sub.end_date}</span>
                    </div>
                    <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden p-0.5 border border-white/10">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sub.is_expired
                            ? 'bg-rose-500'
                            : sub.is_expiring_soon
                            ? 'bg-amber-400'
                            : 'bg-[#00CCCD]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, sub.progress_pct))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Billing & Tech Stats */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Techs</span>
                    <span className="font-black text-slate-800 text-sm">
                      {comp.billing?.active_technicians || 0} / {sub.limits?.max_technicians === 999 ? '∞' : (sub.limits?.max_technicians || 10)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">License Fee</span>
                    <span className="font-black text-emerald-700 text-sm">
                      Rs. {(comp.billing?.total_fee_amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Admin Accounts */}
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Company Administrators</span>
                  {comp.admins && comp.admins.length > 0 ? (
                    <div className="space-y-1">
                      {comp.admins.map(a => (
                        <div key={a.id} className="text-[11px] font-medium text-slate-700 flex justify-between">
                          <span>{a.name} ({a.email})</span>
                          <span className="text-[10px] text-emerald-600 font-bold">{a.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-600 font-semibold">No admin assigned yet</p>
                  )}
                </div>
              </div>

              {/* Actions Bar */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold gap-2 flex-wrap">
                <button
                  onClick={() => openSubModal(comp)}
                  className="px-2.5 py-1.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#00CCCD]" />
                  <span>Package</span>
                </button>

                <button
                  onClick={() => handleQuickRenew1Month(comp)}
                  title="Renew 1-Month"
                  className="px-2.5 py-1.5 bg-[#00CCCD]/20 hover:bg-[#00CCCD]/30 text-teal-900 border border-[#00CCCD]/40 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>+1 Mo</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedCompany(comp);
                    setIsAdminModalOpen(true);
                  }}
                  className="text-slate-600 hover:text-slate-900 text-[11px] font-bold"
                >
                  + Admin
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleCompanyStatus(comp)}
                    className={`text-[11px] font-bold ${comp.status === 'ACTIVE' ? 'text-amber-600 hover:text-amber-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                  >
                    {comp.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  </button>

                  <Link
                    to={`/super-admin/companies/${comp.id}`}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-800 text-[11px]"
                  >
                    Details
                  </Link>

                  <button
                    onClick={() => handleDeleteCompany(comp)}
                    title="Permanently Delete Company"
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ASSIGN / RENEW SUBSCRIPTION PACKAGE MODAL */}
      {isSubModalOpen && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 bg-gradient-to-r from-[#423A8E] to-[#261f5c] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#00CCCD]" />
                  <span>Assign SaaS Subscription Package</span>
                </h3>
                <p className="text-xs text-slate-300">Tenant: {selectedCompany.name}</p>
              </div>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSubscription} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Package Selection Tabs */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Select Package Type:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const nextCustom = !subForm.is_custom;
                      setSubForm({
                        ...subForm,
                        is_custom: nextCustom,
                        custom_plan_name: nextCustom ? (subForm.custom_plan_name || 'Custom Enterprise Tier') : ''
                      });
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      subForm.is_custom
                        ? 'bg-[#00CCCD] text-slate-950 ring-2 ring-[#00CCCD]/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {subForm.is_custom ? '✓ Custom Mode Active' : '+ Switch to Custom Plan'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    ...(availablePlans && availablePlans.length > 0
                      ? availablePlans.map(p => ({
                          id: p.id,
                          name: p.name,
                          price: Number(p.price) || 0,
                          techs: p.max_technicians || p.limits?.max_technicians || 10,
                          units: p.max_units || p.limits?.max_ac_units || 500,
                          isCustom: false
                        }))
                      : [
                          { id: 'custom_1', name: 'Custom Package 1', price: 6000, techs: 5, units: 250, isCustom: false },
                          { id: 'custom_2', name: 'Custom Package 2', price: 15000, techs: 20, units: 1000, isCustom: false }
                        ]
                    ),
                    { id: 'custom', name: 'Custom Tier', price: subForm.price, isCustom: true }
                  ].map(p => {
                    const isSelected = p.isCustom ? subForm.is_custom : (!subForm.is_custom && subForm.plan_id?.toLowerCase() === p.id?.toLowerCase());
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (p.isCustom) {
                            setSubForm({
                              ...subForm,
                              is_custom: true,
                              custom_plan_name: subForm.custom_plan_name || 'Custom Tier'
                            });
                          } else {
                            setSubForm({
                              ...subForm,
                              is_custom: false,
                              plan_id: p.id,
                              price: p.price,
                              custom_max_technicians: p.techs,
                              custom_max_units: p.units,
                              custom_plan_name: ''
                            });
                          }
                        }}
                        className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#423A8E] bg-[#423A8E]/5 ring-2 ring-[#423A8E]/20 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="font-black text-xs text-slate-900">{p.name}</div>
                        <div className="font-black font-mono text-[11px] text-[#423A8E] mt-0.5">
                          {p.isCustom ? 'Bespoke' : `Rs. ${p.price.toLocaleString()}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Plan Name if in custom mode */}
              {subForm.is_custom && (
                <div className="p-3.5 bg-sky-50/80 rounded-2xl border border-sky-200 space-y-2 animate-in fade-in">
                  <label className="block text-xs font-black text-sky-950 uppercase tracking-wider">
                    Custom Package Name / Label *
                  </label>
                  <input
                    type="text"
                    required={subForm.is_custom}
                    placeholder="e.g. VIP Commercial Partner / Exclusive Fleet"
                    value={subForm.custom_plan_name}
                    onChange={(e) => setSubForm({ ...subForm, custom_plan_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-sky-300 bg-white rounded-xl focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              {/* Price & Limits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Monthly Price (LKR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={subForm.price}
                    onChange={(e) => setSubForm({ ...subForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs font-mono font-black text-[#423A8E] border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Max Tech Accounts
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 10"
                    value={subForm.custom_max_technicians || ''}
                    onChange={(e) => setSubForm({ ...subForm, custom_max_technicians: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Max AC Units
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 500"
                    value={subForm.custom_max_units || ''}
                    onChange={(e) => setSubForm({ ...subForm, custom_max_units: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Start Date & End Date / Duration Presets */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                    Subscription Dates & Active Period:
                  </label>
                  <div className="flex gap-1">
                    {[
                      { label: '+1 Mo', months: 1 },
                      { label: '+3 Mo', months: 3 },
                      { label: '+6 Mo', months: 6 },
                      { label: '+1 Yr', months: 12 }
                    ].map(d => (
                      <button
                        key={d.months}
                        type="button"
                        onClick={() => {
                          const base = subForm.start_date ? new Date(subForm.start_date) : new Date();
                          const newEnd = new Date(base);
                          newEnd.setMonth(newEnd.getMonth() + d.months);
                          newEnd.setDate(newEnd.getDate() - 1);
                          setSubForm({ ...subForm, end_date: newEnd.toISOString().split('T')[0] });
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-black cursor-pointer"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Start Date</label>
                    <input
                      type="date"
                      required
                      value={subForm.start_date}
                      onChange={(e) => setSubForm({ ...subForm, start_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">End Date (Expiration)</label>
                    <input
                      type="date"
                      required
                      value={subForm.end_date}
                      onChange={(e) => setSubForm({ ...subForm, end_date: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Auto-renew checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto_renew_check"
                  checked={subForm.auto_renew}
                  onChange={(e) => setSubForm({ ...subForm, auto_renew: e.target.checked })}
                  className="rounded-md border-slate-300 text-[#423A8E] focus:ring-[#423A8E]"
                />
                <label htmlFor="auto_renew_check" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Enable Monthly Auto-Renew for this Tenant
                </label>
              </div>

              {/* Total Calculation / Preview Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Configured Plan</span>
                  <div className="font-black text-slate-900 text-sm">
                    {subForm.is_custom ? (subForm.custom_plan_name || 'Custom Plan') : subForm.plan_id.toUpperCase()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Monthly Recurring</span>
                  <div className="font-mono font-black text-[#423A8E] text-sm">
                    Rs. {Number(subForm.price).toLocaleString()} / mo
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subscribing}
                  className="px-5 py-2.5 text-xs font-black bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl shadow-lg shadow-[#423A8E]/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${subscribing ? 'animate-spin' : ''}`} />
                  <span>{subscribing ? 'Saving Custom Plan...' : 'Save & Assign Subscription'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE COMPANY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 bg-[#423A8E] text-white flex justify-between items-center">
              <h3 className="font-black text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#00CCCD]" /> Create AC Company (Tenant)
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Air Conditioning"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Anura Kumara"
                    value={companyForm.owner_name}
                    onChange={(e) => setCompanyForm({ ...companyForm, owner_name: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="0771234567"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="0771234567"
                    value={companyForm.whatsapp}
                    onChange={(e) => setCompanyForm({ ...companyForm, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="info@apex-aircon.lk"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registration Number</label>
                  <input
                    type="text"
                    placeholder="PV-102938"
                    value={companyForm.registration_number}
                    onChange={(e) => setCompanyForm({ ...companyForm, registration_number: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="123 Galle Road, Colombo"
                  value={companyForm.address}
                  onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={companyForm.invoice_prefix}
                    onChange={(e) => setCompanyForm({ ...companyForm, invoice_prefix: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Currency</label>
                  <input
                    type="text"
                    value={companyForm.currency}
                    onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={companyForm.status}
                    onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl shadow-md cursor-pointer"
                >
                  Create Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ADMIN MODAL */}
      {isAdminModalOpen && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-5 bg-[#423A8E] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base">Create Company Admin</h3>
                <p className="text-xs text-slate-300">For: {selectedCompany.name}</p>
              </div>
              <button onClick={() => setIsAdminModalOpen(false)} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admin Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Admin"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@apex-aircon.lk"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile</label>
                  <input
                    type="text"
                    placeholder="0771234567"
                    value={adminForm.mobile}
                    onChange={(e) => setAdminForm({ ...adminForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username / Login ID</label>
                  <input
                    type="text"
                    placeholder="apexadmin"
                    value={adminForm.username}
                    onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl shadow-md cursor-pointer"
                >
                  Confirm Admin Creation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
