import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, Smartphone, Search, RefreshCw, Filter, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CommunicationLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    let url = '/api/communication/logs';
    if (channelFilter) url += `?channel=${channelFilter}`;

    axios.get(url)
      .then(res => {
        setLogs(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load comm logs:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, [channelFilter]);

  const filtered = logs.filter(l =>
    l.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone_number?.includes(searchTerm) ||
    l.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.message_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-sky-600" /> SMS & WhatsApp Dispatch History
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full audit log of customer messages, delivery statuses, and gateway responses.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {['', 'SMS', 'WHATSAPP'].map(ch => (
          <button
            key={ch}
            onClick={() => setChannelFilter(ch)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              channelFilter === ch
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {ch ? (ch === 'SMS' ? 'Text.lk SMS' : 'WhatsApp Gateway') : 'All Channels'}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 pl-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter by customer name, phone number, or message text..."
          className="w-full text-xs outline-hidden font-medium"
        />
      </div>

      {/* Communication Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Channel</th>
                <th className="p-3.5">Recipient</th>
                <th className="p-3.5">Template Type</th>
                <th className="p-3.5">Message Content</th>
                <th className="p-3.5">Delivery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    {log.channel === 'SMS' ? (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200 inline-flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Text.lk SMS
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                        <Smartphone className="w-3 h-3" /> WhatsApp
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900">{log.customer_name || 'Customer'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{log.phone_number}</p>
                  </td>
                  <td className="p-3.5">
                    <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      {log.message_type}
                    </span>
                  </td>
                  <td className="p-3.5 max-w-md">
                    <p className="text-slate-700 leading-relaxed text-xs">{log.message}</p>
                    {log.error_message && (
                      <p className="text-[10px] text-rose-600 mt-0.5">{log.error_message}</p>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                      log.delivery_status === 'DELIVERED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (log.delivery_status === 'SENT' ? 'bg-sky-100 text-sky-800' : 'bg-rose-100 text-rose-800')
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${log.delivery_status === 'DELIVERED' ? 'bg-emerald-600' : (log.delivery_status === 'SENT' ? 'bg-sky-600' : 'bg-rose-600')}`} />
                      {log.delivery_status}
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
