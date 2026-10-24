import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2,
  Users,
  Wrench,
  DollarSign,
  FileText,
  CreditCard,
  QrCode,
  Shield,
  ArrowLeft,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CompanyDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { switchCompanyContext } = useAuth();

  useEffect(() => {
    axios.get(`/api/super-admin/companies/${id}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load company detail:', err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8 text-xs text-slate-400">Loading Company Data...</div>;
  if (!data || !data.company) return <div className="p-8 text-xs text-rose-500">Company not found.</div>;

  const { company, billing, users, customers, units, jobs, invoices } = data;

  return (
    <div className="space-y-6">
      {/* Back button & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/super-admin/companies"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{company.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                company.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {company.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Owner: {company.owner_name} • Phone: {company.phone} • Email: {company.email}
            </p>
          </div>
        </div>

        <button
          onClick={() => switchCompanyContext(company.id)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5"
        >
          <Building2 className="w-4 h-4" /> Open Company Workspace
        </button>
      </div>

      {/* SaaS Subscription Info */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Technicians</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{billing?.active_technicians || 0}</span>
          <span className="text-[11px] text-slate-500 font-medium">Total registered: {billing?.total_technicians || 0}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Monthly Subscription</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">Rs. {(billing?.monthly_amount || 0).toLocaleString()}</span>
          <span className="text-[11px] text-slate-500 font-medium">{billing?.formula}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Customers</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{customers?.length || 0}</span>
          <span className="text-[11px] text-slate-500 font-medium">{units?.length || 0} AC Units Installed</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Service Jobs</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{jobs?.length || 0}</span>
          <span className="text-[11px] text-slate-500 font-medium">{invoices?.length || 0} Invoices Issued</span>
        </div>
      </div>

      {/* Users & Technicians List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 font-extrabold text-xs text-slate-800 uppercase tracking-wider">
          Company Staff & Technicians
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Role</th>
                <th className="p-3">Email / Username</th>
                <th className="p-3">Mobile</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{u.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{u.email} ({u.username})</td>
                  <td className="p-3 text-slate-600">{u.mobile || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {u.status}
                    </span>
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
