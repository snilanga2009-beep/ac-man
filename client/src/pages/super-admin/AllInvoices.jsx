import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Search, Building2, DollarSign, Download, Calendar } from 'lucide-react';

export default function AllInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    axios.get('/api/super-admin/invoices')
      .then(res => {
        setInvoices(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load global invoices:', err);
        setLoading(false);
      });
  }, []);

  const filtered = invoices.filter(inv =>
    inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" /> Platform Invoices Directory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-tenant overview of all customer invoices issued across companies.
          </p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400 pl-1" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by invoice number, customer name, or company..."
          className="w-full text-xs outline-hidden font-medium"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Company Tenant</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Total Amount</th>
                <th className="p-3.5">Paid Amount</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-bold font-mono text-sky-700">{inv.invoice_number}</td>
                  <td className="p-3.5 font-bold text-slate-900">{inv.company_name}</td>
                  <td className="p-3.5 text-slate-700">{inv.customer_name}</td>
                  <td className="p-3.5 text-slate-500">{inv.issue_date}</td>
                  <td className="p-3.5 font-extrabold text-slate-800">Rs. {Number(inv.total).toLocaleString()}</td>
                  <td className="p-3.5 text-emerald-600 font-bold">Rs. {Number(inv.amount_paid || 0).toLocaleString()}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (inv.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')
                    }`}>
                      {inv.status}
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
