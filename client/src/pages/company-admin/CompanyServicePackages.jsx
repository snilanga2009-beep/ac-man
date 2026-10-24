import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Sparkles,
  Plus,
  Clock,
  DollarSign,
  X,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Tag,
  Copy,
  Edit3,
  Layers,
  Wrench,
  Info,
  Calendar,
  ArrowRight,
  Check,
  RefreshCw
} from 'lucide-react';

export default function CompanyServicePackages() {
  const [activeTab, setActiveTab] = useState('CUSTOM'); // 'CUSTOM' | 'GLOBAL'
  const [customPackages, setCustomPackages] = useState([]);
  const [globalPackages, setGlobalPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 4500,
    duration_minutes: 60,
    interval_months: 3
  });

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch company custom packages (Strictly company_id only, no global)
      const customRes = await axios.get('/api/company/service-packages', { params: { scope: 'custom' } });
      setCustomPackages(customRes.data || []);

      // 2. Fetch global template packages for reference/cloning
      const globalRes = await axios.get('/api/company/service-packages', { params: { scope: 'global' } });
      setGlobalPackages(globalRes.data || []);
    } catch (err) {
      console.error('Failed to load service packages:', err);
      setErrorMsg('Failed to load service packages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  const handleOpenCreateModal = () => {
    setEditingPackage(null);
    setForm({
      name: '',
      description: '',
      price: 4500,
      duration_minutes: 60,
      interval_months: 3
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pkg) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      price: pkg.price || 4500,
      duration_minutes: pkg.duration_minutes || 60,
      interval_months: pkg.interval_months || 3
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingPackage) {
        // Update existing custom package
        await axios.put(`/api/company/service-packages/${editingPackage.id}`, form);
        showSuccess(`Package "${form.name}" updated successfully!`);
      } else {
        // Create new custom package
        await axios.post('/api/company/service-packages', form);
        showSuccess(`Custom package "${form.name}" created successfully!`);
      }
      setIsModalOpen(false);
      setEditingPackage(null);
      fetchPackages();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to save service package');
    }
  };

  const handleDelete = async (pkg) => {
    if (!confirm(`Are you sure you want to permanently delete custom package "${pkg.name}"?`)) return;
    try {
      await axios.delete(`/api/company/service-packages/${pkg.id}`);
      showSuccess(`Deleted "${pkg.name}".`);
      fetchPackages();
    } catch (err) {
      showError(err.response?.data?.error || 'Cannot delete this package');
    }
  };

  const handleCloneFromTemplate = async (templatePkg) => {
    try {
      await axios.post(`/api/company/service-packages/clone/${templatePkg.id}`);
      showSuccess(`Adopted "${templatePkg.name}" into your custom packages!`);
      setActiveTab('CUSTOM');
      fetchPackages();
    } catch (err) {
      showError(err.response?.data?.error || 'Failed to clone template package');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 pb-24 overflow-x-hidden font-sans">
      {/* 1. HEADER BANNER WITH HANDYMAN GREEN THEME */}
      <div className="bg-gradient-to-r from-[#15803D] via-[#16A34A] to-slate-900 rounded-3xl p-4 sm:p-7 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-amber-300 text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" /> Company Custom Pricing & Packages
          </span>
          <h1 className="text-xl sm:text-2xl font-black mt-1.5">Service Packages</h1>
          <p className="text-xs text-emerald-100 mt-1 max-w-2xl leading-relaxed">
            Create custom service packages with your own fixed prices, durations, and maintenance intervals. When custom packages are created, only your company's custom packages appear in quotations, job booking, and technician field apps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchPackages}
            className="px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-[#22C55E] hover:opacity-95 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Custom Package</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <X className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. TAB TOGGLE: MY CUSTOM PACKAGES vs GLOBAL TEMPLATES */}
      <div className="bg-white rounded-3xl border border-slate-200 p-2 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('CUSTOM')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'CUSTOM'
                ? 'bg-[#16A34A] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>My Custom Packages ({customPackages.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GLOBAL')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'GLOBAL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Global Template Library ({globalPackages.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-bold px-3">
          {activeTab === 'CUSTOM' ? (
            <span className="text-emerald-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Showing only your company packages (No other companies or global packages)
            </span>
          ) : (
            <span className="text-slate-500">
              Browse standard industry templates and click "Adopt to Custom" to import
            </span>
          )}
        </div>
      </div>

      {/* 3. PACKAGES LIST */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-[#16A34A]" />
          <span>Loading service packages...</span>
        </div>
      ) : activeTab === 'CUSTOM' ? (
        /* ================= TAB 1: CUSTOM PACKAGES ONLY ================= */
        customPackages.length === 0 ? (
          <div className="bg-white rounded-3xl border-2 border-dashed border-emerald-200 p-8 sm:p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-[#16A34A] flex items-center justify-center mx-auto shadow-sm">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                No Custom Service Packages Yet
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                You haven't created any custom service packages. Once you create custom packages, they will strictly be the only packages shown across your entire company portal, quotations, and technician app.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white text-xs font-black shadow-md cursor-pointer hover:opacity-95 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Create Custom Package
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('GLOBAL')}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4" /> Import From Template Library
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative overflow-hidden"
              >
                {/* Accent top stripe */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#22C55E] to-[#16A34A]" />

                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Custom Company Package
                      </span>
                      <h3 className="font-black text-sm sm:text-base text-slate-900 mt-1.5 leading-snug">
                        {pkg.name}
                      </h3>
                    </div>
                    <span className="font-black text-sm sm:text-base text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 shrink-0 shadow-2xs">
                      Rs. {Number(pkg.price || 0).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed min-h-[2.5rem]">
                    {pkg.description || 'Full comprehensive AC service and chemical washing treatment.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {pkg.duration_minutes || 60}m
                    </span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-200">
                      Every {pkg.interval_months || 3} mo
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(pkg)}
                      className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                      title="Edit Custom Package"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(pkg)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="Delete Custom Package"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ================= TAB 2: GLOBAL TEMPLATE LIBRARY ================= */
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                These are standard global templates. Click <strong>"Adopt / Copy to Custom"</strong> to copy any package into your company with your own custom price.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('CUSTOM')}
              className="text-emerald-400 font-black hover:underline shrink-0"
            >
              Back to My Custom Packages &rarr;
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {globalPackages.map((tmpl) => (
              <div
                key={tmpl.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Global Standard Template
                      </span>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 mt-1.5 leading-snug">
                        {tmpl.name}
                      </h3>
                    </div>
                    <span className="font-black text-sm text-slate-700 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 shrink-0">
                      Rs. {Number(tmpl.price || 0).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed min-h-[2.5rem]">
                    {tmpl.description || 'Standard industry recommended service package.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {tmpl.duration_minutes || 60}m
                    </span>
                    <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200">
                      Every {tmpl.interval_months || 3} mo
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCloneFromTemplate(tmpl)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:opacity-95 text-white font-black text-xs flex items-center gap-1 shadow-xs cursor-pointer transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Adopt to Custom</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ADD / EDIT SERVICE PACKAGE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-[#15803D] to-[#16A34A] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{editingPackage ? 'Edit Custom Service Package' : 'Create Custom Service Package'}</span>
                </h3>
                <p className="text-[11px] text-emerald-100 mt-0.5">
                  Exclusively for your company (Never shared with other companies)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Package Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Master Chemical Overhaul Wash"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-2xl focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Package Description
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Includes chemical foam treatment, drain pipe flush, coil sanitization..."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-2xl focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Price (LKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-black text-slate-900 focus:border-[#16A34A] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Duration (Min)
                  </label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-black text-slate-900 focus:border-[#16A34A] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Interval (Mo)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={form.interval_months}
                    onChange={(e) => setForm({ ...form, interval_months: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-xl font-black text-slate-900 focus:border-[#16A34A] outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-gradient-to-r from-[#22C55E] to-[#16A34A] hover:opacity-95 text-white rounded-xl shadow-md cursor-pointer"
                >
                  {editingPackage ? 'Save Changes' : 'Create Custom Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
