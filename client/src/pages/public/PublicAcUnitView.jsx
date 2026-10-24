import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Airplay, QrCode, CheckCircle2, Calendar, Phone, ShieldCheck, MapPin, Clock, User, Wrench } from 'lucide-react';

const formatDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffMs = end.getTime() - start.getTime();
  if (isNaN(diffMs) || diffMs < 0) return null;
  const totalMins = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) {
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
  }
  return `${mins} mins`;
};

export default function PublicAcUnitView() {
  const { qrCodeId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/api/ac-units/verify/${qrCodeId}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError('QR Code is invalid or AC unit record not found.');
        setLoading(false);
      });
  }, [qrCodeId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Verifying AC Unit QR Tag...</div>;

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-3">
          <QrCode className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-extrabold text-slate-900">AC Unit Verification Failed</h2>
          <p className="text-xs text-slate-500">{error}</p>
          <Link to="/login" className="inline-block px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl mt-4">
            Go to Portal
          </Link>
        </div>
      </div>
    );
  }

  const { unit, service_history = [] } = data;

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Airplay className="w-7 h-7 text-white" />
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
            Verified AC Unit
          </span>
          <h1 className="text-xl font-extrabold mt-1">{unit.brand} {unit.model_number || ''}</h1>
          <p className="text-xs text-sky-100 mt-0.5 font-mono">{unit.qr_code_id}</p>
        </div>

        {/* Specs */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Cooling Capacity</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{Number(unit.capacity_btu).toLocaleString()} BTU</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Location</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">{unit.location_in_building || 'Main Premises'}</span>
            </div>
            <div className="border-t border-slate-200/60 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Last Service</span>
              <span className="font-bold text-slate-700">{unit.last_service_date || 'N/A'}</span>
            </div>
            <div className="border-t border-slate-200/60 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Next Service Target</span>
              <span className="font-extrabold text-sky-700">{unit.next_service_date || 'Schedule Soon'}</span>
            </div>
          </div>

          {/* Service Provider Info */}
          <div className="p-4 bg-sky-50 rounded-2xl border border-sky-200/80 space-y-1 text-xs">
            <span className="text-[10px] font-bold text-sky-800 uppercase block">Authorized Service Provider</span>
            <p className="font-extrabold text-slate-900 text-sm">{unit.company_name}</p>
            <p className="text-slate-600 flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5 text-sky-600" /> Hotline: {unit.company_phone || 'Support line'}
            </p>
          </div>

          {/* Service History */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center justify-between">
              <span>Verified Service Records</span>
              <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{service_history.length}</span>
            </h3>
            {service_history.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No past service records logged yet.</p>
            ) : (
              service_history.map(s => {
                const dur = formatDuration(s.started_at, s.completed_at);
                return (
                  <div key={s.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs shadow-2xs">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {s.package_name || s.service_type?.replace('_', ' ') || 'Routine AC Service'}
                          </span>
                          {s.job_number && (
                            <span className="font-mono text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              #{s.job_number}
                            </span>
                          )}
                        </div>
                        {s.technician_name && (
                          <p className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-slate-400" /> Technician: {s.technician_name}
                          </p>
                        )}
                      </div>
                      <span className="text-slate-600 font-bold bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-[11px] shrink-0">
                        {s.completed_at ? new Date(s.completed_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : s.scheduled_date}
                      </span>
                    </div>

                    {/* Work Timing & Service Duration */}
                    {(s.started_at || s.completed_at) && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-indigo-50/80 px-2.5 py-1.5 rounded-xl border border-indigo-100 text-[11px]">
                        <div className="flex items-center gap-1.5 text-indigo-950 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>
                            {s.started_at ? `Started: ${new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                            {s.started_at && s.completed_at ? ' • ' : ''}
                            {s.completed_at ? `Finished: ${new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </span>
                        </div>
                        {dur && (
                          <span className="font-mono text-[10px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-md">
                            ⏱️ {dur}
                          </span>
                        )}
                      </div>
                    )}

                    {s.work_performed && (
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100">
                        {s.work_performed}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
