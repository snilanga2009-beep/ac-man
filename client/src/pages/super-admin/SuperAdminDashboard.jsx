import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2,
  Users,
  Wrench,
  DollarSign,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/super-admin/dashboard')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching super admin dashboard:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading SaaS Platform Dashboard...</div>;
  }

  const billing = data?.billing || {};
  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-purple-900/30">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase tracking-wider">
              Master Platform Owner
            </span>
          </div>
          <h1 className="text-2xl font-extrabold mt-1">Super Admin Control Center</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-tenant health, billable technician revenue, and communication gateways.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/super-admin/companies"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
          >
            <Building2 className="w-4 h-4" /> Manage Companies
          </Link>
          <Link
            to="/super-admin/billing"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4" /> SaaS Billing
          </Link>
        </div>
      </div>

      {/* High-level SaaS Platform Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total AC Companies</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{billing.total_companies || 0}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                {billing.active_companies || 0} Active Subscriptions
              </p>
            </div>
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Billable Technicians</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{billing.billable_technicians || 0}</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                Total: {billing.total_technicians || 0} registered
              </p>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monthly SaaS Revenue</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
                Rs. {(billing.monthly_technician_revenue || 0).toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                Fee: Rs. {(billing.default_technician_price || 2000).toLocaleString()}/tech/mo
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SMS & WhatsApp Dispatches</p>
              <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
                {(metrics.totalSmsSent || 0) + (metrics.totalWhatsAppSent || 0)}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">
                {metrics.totalSmsSent || 0} SMS • {metrics.totalWhatsAppSent || 0} WA
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Companies & Recent Audit Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies Overview Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Registered Companies
            </h3>
            <Link to="/super-admin/companies" className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100">
                <tr>
                  <th className="p-3">Company</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Active Techs</th>
                  <th className="p-3">Monthly Charge</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(billing.companies || []).slice(0, 5).map(c => (
                  <tr key={c.company_id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-bold text-slate-800">{c.company_name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.company_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {c.company_status}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-700">{c.active_technicians}</td>
                    <td className="p-3 font-extrabold text-emerald-700">Rs. {c.monthly_amount.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Link
                        to={`/super-admin/companies/${c.company_id}`}
                        className="px-2.5 py-1 text-xs font-bold text-sky-600 hover:bg-sky-50 rounded-lg"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Audit Log Stream */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" /> SaaS Audit Stream
              </h3>
              <Link to="/super-admin/audit-logs" className="text-xs font-bold text-sky-600">
                All Logs
              </Link>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {(data?.recentLogs || []).map((log) => (
                <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-0.5">
                    <span>{log.user_name} ({log.user_role})</span>
                    <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="font-bold text-slate-800">{log.action}</p>
                  {log.details && (
                    <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">{log.details}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
