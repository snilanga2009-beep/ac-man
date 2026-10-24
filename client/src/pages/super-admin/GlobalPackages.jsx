import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles,
  Plus,
  Clock,
  DollarSign,
  X,
  Edit,
  Trash2,
  CheckCircle2,
  RotateCw,
  ShieldCheck,
  Calendar,
  Layers
} from 'lucide-react';

export default function GlobalPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null); // null when creating, object when editing
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 4500,
    duration_minutes: 60,
    interval_months: 3
  });

  const fetchPackages = (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    axios.get('/api/super-admin/service-packages')
      .then(res => {
        setPackages(res.data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(err => {
        console.error('Failed to load global packages:', err);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingPackage(null);
    setForm({
      name: '',
      description: '',
      price: 4500,
      duration_minutes: 60,
      interval_months: 3
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (pkg) => {
    setEditingPackage(pkg);
    setForm({
      name: pkg.name || '',
      description: pkg.description || '',
      price: pkg.price || 0,
      duration_minutes: pkg.duration_minutes || 60,
      interval_months: pkg.interval_months || 3
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (editingPackage) {
        // Edit existing package
        await axios.put(`/api/super-admin/service-packages/${editingPackage.id}`, form);
        setSuccessMsg(`Global package "${form.name}" updated successfully!`);
      } else {
        // Create new package
        await axios.post('/api/super-admin/service-packages', form);
        setSuccessMsg(`New global package "${form.name}" created successfully!`);
      }

      setIsModalOpen(false);
      fetchPackages(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to save service package.');
    }
  };

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Are you sure you want to permanently delete the global package "${pkg.name}"?`)) {
      return;
    }

    try {
      await axios.delete(`/api/super-admin/service-packages/${pkg.id}`);
      setSuccessMsg(`Global package "${pkg.name}" deleted successfully.`);
      fetchPackages(true);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete service package.');
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center w-full">
        <div className="animate-spin w-10 h-10 border-4 border-[#423A8E] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm font-bold text-slate-700">Loading Global AC Service Packages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Toast Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span className="text-xs font-bold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-white/80 hover:text-white font-bold text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#423A8E]/10 text-[#423A8E] border border-[#423A8E]/20 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-[#423A8E]" />
              Super Admin Control Center
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            Global AC Service Packages & Pricing
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            Standard AC maintenance templates, pricing benchmarks, and service intervals made available to all tenant AC companies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => fetchPackages(true)}
            disabled={refreshing}
            title="Refresh Packages"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#423A8E]' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl text-xs font-black shadow-md shadow-[#423A8E]/30 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#00CCCD]" />
            <span>+ Add Service Package</span>
          </button>
        </div>
      </div>

      {/* Packages Grid */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No global service packages configured</h3>
          <p className="text-xs text-slate-400 mt-1">Click "+ Add Service Package" to define your first global standard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map(pkg => (
            <div
              key={pkg.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:border-[#423A8E]/40 hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-4 relative group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#423A8E]/10 text-[#423A8E] border border-[#423A8E]/20 inline-block">
                      Global Standard
                    </span>
                    <h3 className="font-black text-base text-slate-900 mt-2 tracking-tight">{pkg.name}</h3>
                  </div>
                  <span className="font-black text-base text-slate-950 bg-[#FFC107] px-3 py-1 rounded-xl shadow-xs shrink-0 whitespace-nowrap">
                    Rs. {Number(pkg.price || 0).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed min-h-[48px]">
                  {pkg.description || 'Comprehensive AC service, coil chemical cleaning, and performance inspection.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-600 flex-wrap">
                  <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {pkg.duration_minutes || 60} mins
                  </span>
                  <span className="font-bold text-[#423A8E] bg-[#423A8E]/10 px-2.5 py-1 rounded-xl border border-[#423A8E]/20">
                    Every {pkg.interval_months || 3} months
                  </span>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleOpenEditModal(pkg)}
                    className="p-2 text-slate-600 hover:text-[#423A8E] hover:bg-[#423A8E]/10 rounded-xl transition-colors cursor-pointer"
                    title="Edit Global Package Price & Details"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(pkg)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete Package"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Service Package Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#423A8E] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00CCCD]" />
                <h3 className="font-black text-base">
                  {editingPackage ? 'Edit Global Service Package' : 'Create New Global Package'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Master Overhaul Deep Chemical Wash"
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#423A8E] focus:border-[#423A8E] outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description & Scope</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Chemical coil cleaning, gas pressure check, electrical test, blower wheel wash..."
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#423A8E] focus:border-[#423A8E] outline-hidden font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (LKR) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#423A8E] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Mins) *</label>
                  <input
                    type="number"
                    required
                    min={15}
                    step={15}
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#423A8E] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Interval (Months) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={24}
                    value={form.interval_months}
                    onChange={(e) => setForm({ ...form, interval_months: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#423A8E] font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black bg-[#423A8E] hover:bg-[#342c74] text-white rounded-xl shadow-md shadow-[#423A8E]/30 transition-all cursor-pointer"
                >
                  {editingPackage ? 'Update Package' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
