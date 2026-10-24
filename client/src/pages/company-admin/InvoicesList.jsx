import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Plus,
  Search,
  DollarSign,
  Smartphone,
  MessageSquare,
  Send,
  CheckCircle2,
  X,
  Printer,
  Wrench,
  QrCode,
  Share2
} from 'lucide-react';
import InvoiceModal from '../../components/InvoiceModal';

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchInvoices = () => {
    setLoading(true);
    axios.get('/api/invoices')
      .then(res => {
        setInvoices(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load invoices:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInvoices();
    axios.get('/api/customers').then(res => setCustomers(res.data || [])).catch(e => {});
  }, []);

  const handleShareWhatsApp = (inv) => {
    const phone = (inv.whatsapp || inv.customer_whatsapp || inv.customer_phone || '').replace(/[^0-9]/g, '');
    const rawItems = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    const itemsList = rawItems.map(i => `• ${i.description} (x${i.qty}): Rs. ${(i.unit_price * i.qty).toLocaleString()}`).join('%0A');
    const text = `*${inv.company_name || 'AC-Pro'} - Service Invoice #${inv.invoice_number}*%0A%0ADear ${inv.customer_name},%0AYour invoice details:%0A%0A${itemsList}%0A%0A*Total: Rs. ${Number(inv.total).toLocaleString()}*%0AAmount Paid: Rs. ${Number(inv.amount_paid || 0).toLocaleString()}%0AStatus: *${inv.status}*%0A%0AThank you! (Hotline: ${inv.company_phone || ''})`;
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const filtered = invoices.filter(inv => {
    const matchesSearch =
      inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.job_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? inv.status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-sky-600" /> Invoices & Customer Payments
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage job-linked invoices, adjust extra parts/services, track payment collections, and share via WhatsApp & PDF.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedInvoice(null);
            setIsInvoiceModalOpen(true);
          }}
          className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-600/30 transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Custom Invoice
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex-1 w-full bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 pl-1" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by invoice #, job #, or customer name..."
            className="w-full text-xs outline-hidden font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {['', 'PAID', 'UNPAID', 'PARTIALLY_PAID'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {st ? st.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-3.5">Invoice #</th>
                <th className="p-3.5">Customer & Contact</th>
                <th className="p-3.5">Linked Service Job</th>
                <th className="p-3.5">Issue Date</th>
                <th className="p-3.5">Total Amount</th>
                <th className="p-3.5">Amount Paid</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-mono font-extrabold text-sky-800">
                    {inv.invoice_number}
                  </td>
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900">{inv.customer_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{inv.customer_phone}</p>
                  </td>
                  <td className="p-3.5">
                    <div className="space-y-1">
                      {inv.job_number ? (
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 text-[10px]">
                            {inv.job_number}
                          </span>
                          <p className="text-[11px] text-slate-500 font-semibold">{inv.service_type || 'AC Service'}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px] block">Direct Invoice</span>
                      )}
                      {inv.quotation_number && (
                        <span className="inline-block font-mono font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[10px]">
                          Based on Quotation {inv.quotation_number} {inv.quotation_version ? `(v${inv.quotation_version})` : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-500">{inv.issue_date}</td>
                  <td className="p-3.5 font-extrabold text-slate-900 text-sm">
                    Rs. {Number(inv.total).toLocaleString()}
                  </td>
                  <td className="p-3.5 text-emerald-600 font-bold">
                    Rs. {Number(inv.amount_paid || 0).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : (inv.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-rose-100 text-rose-800 border border-rose-200')
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleShareWhatsApp(inv)}
                        title="Share Invoice via WhatsApp"
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 transition-colors"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setIsInvoiceModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        View / Pay
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Modal */}
      <InvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        customers={customers}
        existingInvoice={selectedInvoice}
        onSuccess={() => fetchInvoices()}
      />
    </div>
  );
}
