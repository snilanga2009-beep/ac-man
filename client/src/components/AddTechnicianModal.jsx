import React, { useState } from 'react';
import axios from 'axios';
import {
  UserPlus,
  AlertCircle,
  X,
  Shield,
  CheckCircle2,
  Sparkles,
  Smartphone,
  MessageSquare,
  Send,
  ExternalLink
} from 'lucide-react';

export default function AddTechnicianModal({ isOpen, onClose, onSuccess, currentTechPrice = 2000 }) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    profile_photo: '',
    username: '',
    password: '',
    status: 'ACTIVE',
    send_pwa_link: true,
    notification_channel: 'BOTH'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const pwaUrl = `${window.location.origin}/technician/pwa`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/api/company/technicians', {
        ...formData,
        app_url: pwaUrl
      });
      setLoading(false);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || 'Failed to add technician');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-cyan-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5" />
            <h3 className="font-bold text-lg">Add Technician</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Technician Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Kasun Perera"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="e.g. 0771234567"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="kasun@abc-aircon.lk"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username / Login ID
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="kasun_tech (defaults to email)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all bg-white"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Profile Photo URL (Optional)
            </label>
            <input
              type="text"
              value={formData.profile_photo}
              onChange={(e) => setFormData({ ...formData, profile_photo: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-all"
            />
          </div>

          {/* Send PWA Link Toggle & Channel Options */}
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-sky-950 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.send_pwa_link}
                  onChange={(e) => setFormData({ ...formData, send_pwa_link: e.target.checked })}
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>📲 Send PWA App Link & Login Credentials Instantly</span>
              </label>
              <span className="text-[10px] font-extrabold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full uppercase">
                Auto Dispatch
              </span>
            </div>

            {formData.send_pwa_link && (
              <div className="pt-2 border-t border-sky-200/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Deliver via:</span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center text-xs text-slate-700 cursor-pointer gap-1">
                      <input
                        type="radio"
                        name="tech_channel"
                        value="SMS"
                        checked={formData.notification_channel === 'SMS'}
                        onChange={(e) => setFormData({ ...formData, notification_channel: e.target.value })}
                        className="text-sky-600"
                      />
                      SMS
                    </label>
                    <label className="inline-flex items-center text-xs text-slate-700 cursor-pointer gap-1">
                      <input
                        type="radio"
                        name="tech_channel"
                        value="WHATSAPP"
                        checked={formData.notification_channel === 'WHATSAPP'}
                        onChange={(e) => setFormData({ ...formData, notification_channel: e.target.value })}
                        className="text-emerald-600"
                      />
                      WhatsApp
                    </label>
                    <label className="inline-flex items-center text-xs text-slate-700 cursor-pointer gap-1">
                      <input
                        type="radio"
                        name="tech_channel"
                        value="BOTH"
                        checked={formData.notification_channel === 'BOTH'}
                        onChange={(e) => setFormData({ ...formData, notification_channel: e.target.value })}
                        className="text-indigo-600"
                      />
                      Both (SMS + WhatsApp)
                    </label>
                  </div>
                </div>

                <p className="text-[11px] text-sky-900/80 bg-white/60 p-2.5 rounded-xl border border-sky-100 leading-relaxed">
                  Technician will receive the <strong>PWA Field App URL ({pwaUrl})</strong> with their username & password via Text.lk SMS & WhatsApp.
                </p>
              </div>
            )}
          </div>

          {/* SaaS Technician One-Time Fee Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Technician One-Time Fee:
              </span>
              <span className="text-xs font-extrabold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-lg">
                LKR {currentTechPrice.toLocaleString()} (One-Time)
              </span>
            </div>
            <p className="text-[11px] text-amber-800 font-medium">
              "Adding this technician will incur a one-time fee of LKR {currentTechPrice.toLocaleString()} (no recurring monthly charge)."
            </p>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-md shadow-sky-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading ? 'Adding Technician...' : 'CONFIRM & ADD TECHNICIAN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
