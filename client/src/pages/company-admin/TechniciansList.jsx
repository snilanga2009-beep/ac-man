import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Wrench,
  Plus,
  Shield,
  CreditCard,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Trash2,
  AlertCircle,
  Phone,
  Mail,
  User,
  Sparkles,
  MessageSquare,
  Smartphone,
  Send,
  ExternalLink
} from 'lucide-react';
import AddTechnicianModal from '../../components/AddTechnicianModal';
import SendTechPwaLinkModal from '../../components/SendTechPwaLinkModal';

export default function TechniciansList() {
  const [data, setData] = useState({ technicians: [], billing: {} });
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [sendPwaTech, setSendPwaTech] = useState(null);

  const fetchTechnicians = () => {
    setLoading(true);
    axios.get('/api/company/technicians')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load technicians:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const handleStatusChange = async (techId, newStatus) => {
    setStatusUpdating(techId);
    try {
      const res = await axios.patch(`/api/company/technicians/${techId}/status`, { status: newStatus });
      setData(prev => ({
        ...prev,
        technicians: prev.technicians.map(t => t.id === techId ? res.data.technician : t),
        billing: res.data.billing
      }));
      setStatusUpdating(null);
    } catch (err) {
      setStatusUpdating(null);
      alert('Failed to update technician status');
    }
  };

  const handleDelete = async (tech) => {
    if (!confirm(`Are you sure you want to remove technician ${tech.name}?`)) return;
    try {
      const res = await axios.delete(`/api/company/technicians/${tech.id}`);
      setData(prev => ({
        ...prev,
        technicians: prev.technicians.filter(t => t.id !== tech.id),
        billing: res.data.billing
      }));
    } catch (err) {
      alert('Failed to delete technician');
    }
  };

  const billing = data.billing || {};
  const technicians = data.technicians || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-sky-600" /> Technicians & One-Time Fee Details
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your service field engineers, send PWA app links via SMS/WhatsApp, and track one-time activation fees.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-sky-600/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> + ADD TECHNICIAN
        </button>
      </div>

      {/* Prominent SaaS Billing Formula Box */}
      <div className="bg-gradient-to-r from-sky-900 via-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-sky-800/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wider flex items-center gap-1 w-fit">
              <Sparkles className="w-3 h-3 text-amber-400" /> One-Time Technician Fee Model
            </span>
            <h3 className="text-lg font-extrabold text-white">Technician User One-Time Activation Fee</h3>
            <p className="text-xs text-slate-300 font-medium max-w-xl">
              Platform owner charges a one-time activation fee of <strong>Rs. {(billing.technician_price || 2000).toLocaleString()}</strong> per technician upon registration. No recurring monthly fee required.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 text-right shrink-0">
            <span className="text-[11px] text-slate-300 font-bold block uppercase tracking-wider">
              One-Time Fee Breakdown
            </span>
            <p className="text-xl font-mono font-extrabold text-cyan-300 mt-1">
              {billing.active_technicians || 0} × Rs. {(billing.technician_price || 2000).toLocaleString()}
            </p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">
              = Rs. {(billing.total_fee_amount || billing.monthly_amount || 0).toLocaleString()} (One-Time)
            </p>
          </div>
        </div>

        {/* 4 Status Breakdown Pills */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] text-emerald-300 font-bold uppercase block">ACTIVE TECHNICIANS</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">{billing.active_technicians || 0}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] text-rose-300 font-bold uppercase block">SUSPENDED</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">{billing.suspended_technicians || 0}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] text-amber-300 font-bold uppercase block">PENDING</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">{billing.pending_technicians || 0}</span>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">TOTAL SEATS</span>
            <span className="text-xl font-extrabold text-white mt-0.5 block">{billing.total_technicians || 0}</span>
          </div>
        </div>
      </div>

      {/* Technicians Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Technician Directory
          </h3>
          <span className="text-[11px] text-slate-500 font-semibold">
            {technicians.length} Technicians Enrolled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Technician</th>
                <th className="p-3.5">Contact Details</th>
                <th className="p-3.5">Working Area (SL)</th>
                <th className="p-3.5">Login ID</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">PWA Access / SMS / WhatsApp</th>
                <th className="p-3.5">Technician Fee</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {technicians.map(tech => (
                <tr key={tech.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-extrabold text-xs border border-sky-200">
                      {tech.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">{tech.name}</p>
                      <p className="text-[10px] text-slate-400">Added: {new Date(tech.created_at).toLocaleDateString()}</p>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div className="space-y-0.5">
                      <p className="text-slate-700 flex items-center gap-1.5 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" /> {tech.mobile || '-'}
                      </p>
                      <p className="text-slate-500 text-[11px] flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-400" /> {tech.email}
                      </p>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 text-[11px] font-bold border border-sky-200">
                      📍 {tech.working_area || 'Colombo'}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-600 font-semibold">{tech.username}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 ${
                      tech.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : (tech.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200')
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tech.status === 'ACTIVE' ? 'bg-emerald-600' : (tech.status === 'SUSPENDED' ? 'bg-rose-600' : 'bg-amber-600')}`} />
                      {tech.status}
                    </span>
                  </td>

                  {/* Send PWA Link & WhatsApp Quick Buttons */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSendPwaTech(tech)}
                        className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-xl text-xs font-bold border border-sky-200 transition-all flex items-center gap-1 shadow-2xs hover:shadow-xs cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-sky-600" />
                        <span>Send PWA Link</span>
                      </button>

                      {tech.mobile && (
                        <a
                          href={`https://wa.me/${tech.mobile.replace(/[^0-9]/g, '').startsWith('0') && tech.mobile.replace(/[^0-9]/g, '').length === 10 ? '94' + tech.mobile.replace(/[^0-9]/g, '').substring(1) : tech.mobile.replace(/[^0-9]/g, '')}?text=*Hello%20${tech.name}*,%0APlease%20access%20your%20AC-Pro%20Technician%20PWA%20App:%20${window.location.origin}/technician/pwa%0AUsername:%20${tech.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-300 transition-all shadow-2xs"
                          title="Share App Link on WhatsApp"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        </a>
                      )}
                    </div>
                  </td>

                  <td className="p-3.5 font-extrabold">
                    <span className="text-emerald-700">Rs. {(billing.technician_price || 2000).toLocaleString()} (One-Time)</span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {tech.status === 'ACTIVE' ? (
                        <button
                          disabled={statusUpdating === tech.id}
                          onClick={() => handleStatusChange(tech.id, 'SUSPENDED')}
                          className="px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          disabled={statusUpdating === tech.id}
                          onClick={() => handleStatusChange(tech.id, 'ACTIVE')}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors"
                        >
                          Activate
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(tech)}
                        title="Remove Technician"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Technician Modal */}
      <AddTechnicianModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        currentTechPrice={billing.technician_price || 2000}
        onSuccess={() => fetchTechnicians()}
      />

      {/* Send Technician PWA Link Modal */}
      <SendTechPwaLinkModal
        isOpen={Boolean(sendPwaTech)}
        onClose={() => setSendPwaTech(null)}
        technician={sendPwaTech}
        onSuccess={() => {}}
      />
    </div>
  );
}
