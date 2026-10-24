import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Wrench, Search, Building2, User, Phone, Mail, ShieldAlert } from 'lucide-react';

export default function AllTechnicians() {
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    axios.get('/api/super-admin/technicians')
      .then(res => {
        setTechnicians(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load technicians:', err);
        setLoading(false);
      });
  }, []);

  const filtered = technicians.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.mobile?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" /> Platform Technicians Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View all technician accounts across all AC service companies.
          </p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 pl-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by technician name, mobile, email, or company name..."
          className="w-full text-xs outline-hidden font-medium"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Technician</th>
                <th className="p-3.5">Assigned Company</th>
                <th className="p-3.5">Mobile</th>
                <th className="p-3.5">Email / Login</th>
                <th className="p-3.5">Billing Status</th>
                <th className="p-3.5">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map(tech => (
                <tr key={tech.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold text-xs">
                      {tech.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span>{tech.name}</span>
                  </td>
                  <td className="p-3.5 font-bold text-sky-700">{tech.company_name}</td>
                  <td className="p-3.5 text-slate-600">{tech.mobile || '-'}</td>
                  <td className="p-3.5 text-slate-600">{tech.email} ({tech.username})</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tech.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (tech.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')
                    }`}>
                      {tech.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-500">{new Date(tech.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
