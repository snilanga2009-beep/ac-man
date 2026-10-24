import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, Building2, Wrench, CreditCard, ShieldCheck, Download, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export default function BillingDashboard() {
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchBilling = () => {
    setLoading(true);
    axios.get('/api/super-admin/billing')
      .then(res => {
        setBillingData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load billing summary:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading SaaS Billing Data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" /> Super Admin SaaS Billing Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time technician seat licensing revenue based on the LKR 2,000 one-time technician activation fee model.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" /> Export Statement
        </button>
      </div>

      {/* Top 4 SaaS Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-white p-5 rounded-2xl shadow-lg shadow-emerald-600/20">
          <p className="text-[11px] font-bold text-emerald-100 uppercase tracking-wider">Total Technician Revenue</p>
          <h3 className="text-3xl font-extrabold mt-1">
            Rs. {(billingData?.total_platform_revenue || 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-emerald-100 font-medium mt-1">
            From {billingData?.billable_technicians || 0} registered technician licenses
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Companies</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{billingData?.total_companies || 0}</h3>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            {billingData?.active_companies || 0} Active Companies
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Technicians (Active / Total)</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
            {billingData?.billable_technicians || 0} <span className="text-slate-400 text-lg font-normal">/ {billingData?.total_technicians || 0}</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            One-Time: Rs. {(billingData?.default_technician_price || 2000).toLocaleString()} / technician
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outstanding Payments</p>
          <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
            Rs. {(billingData?.outstanding_payments || 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            100% Collected (All Current)
          </p>
        </div>
      </div>

      {/* Main SaaS Company Billing Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            Tenant Technician Licensing Breakdown
          </h3>
          <span className="text-[11px] text-slate-500 font-semibold">
            Formula: Active Technicians × One-Time Price = Total Fee Amount
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Company</th>
                <th className="p-3.5 text-center">Active Technicians</th>
                <th className="p-3.5 text-center">Suspended / Non-Active</th>
                <th className="p-3.5">Fee / Technician</th>
                <th className="p-3.5">Total Fee Amount</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(billingData?.companies || []).map((comp) => (
                <tr key={comp.company_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5">
                    <p className="font-extrabold text-slate-900">{comp.company_name}</p>
                    <p className="text-[10px] text-slate-400">ID #{comp.company_id}</p>
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="inline-block px-2.5 py-1 bg-sky-50 text-sky-800 font-bold rounded-lg border border-sky-200">
                      {comp.active_technicians} technicians
                    </span>
                  </td>
                  <td className="p-3.5 text-center text-slate-400 font-bold">
                    {comp.suspended_technicians + comp.pending_technicians + comp.cancelled_technicians}
                  </td>
                  <td className="p-3.5 font-bold text-slate-700">
                    Rs. {comp.technician_price.toLocaleString()} (One-Time)
                  </td>
                  <td className="p-3.5 font-extrabold text-emerald-700 text-sm">
                    Rs. {(comp.total_fee_amount || comp.monthly_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      comp.payment_status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {comp.payment_status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-600 font-semibold">
                    {comp.billing_date || 'Current'}
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
