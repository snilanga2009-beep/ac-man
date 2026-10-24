import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldCheck, Search, Filter, RefreshCw, Calendar, Clock, User } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    axios.get('/api/super-admin/audit-logs')
      .then(res => {
        setLogs(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load audit logs:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log =>
    log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" /> SaaS Security & Audit Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable tracking of tenant creation, technician seat changes, SMS/WhatsApp communications, and payments.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 pl-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter logs by action, user, company name, or details..."
          className="w-full text-xs outline-hidden font-medium"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Company Tenant</th>
                <th className="p-3.5">Details & Record ID</th>
                <th className="p-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className="font-mono font-bold text-purple-900 bg-purple-50 border border-purple-200/60 px-2 py-0.5 rounded-md text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-800 font-semibold">
                    {log.user_name} <span className="text-[10px] text-slate-400 block font-normal">({log.user_role})</span>
                  </td>
                  <td className="p-3.5 font-bold text-slate-700">
                    {log.company_name || 'Global Platform'}
                  </td>
                  <td className="p-3.5 max-w-xs">
                    <p className="text-[11px] font-mono text-slate-600 truncate">{log.details || '-'}</p>
                    {log.record_id && (
                      <span className="text-[10px] text-slate-400 font-semibold">ID: #{log.record_id}</span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                    {log.ip_address || '127.0.0.1'}
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
