import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sliders,
  FileText,
  CreditCard,
  Award,
  Wrench,
  Eye,
  Edit3,
  Check,
  X,
  Send,
  TrendingUp,
  Layers,
  Lock
} from 'lucide-react';
import JobFullDetailModal from '../../components/JobFullDetailModal';

export default function FreelanceCommissionHub() {
  const { user } = useAuth();
  const isTech = user?.role === 'TECHNICIAN' || user?.role === 'FREELANCE_TECHNICIAN';

  const [activeTab, setActiveTab] = useState(isTech ? 'workflow' : 'dashboard');
  const [period, setPeriod] = useState('all'); // today | week | month | year | custom | all
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTechFilter, setSelectedTechFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [rateCards, setRateCards] = useState([]);
  const [packages, setPackages] = useState([]);
  const [ledgerRows, setLedgerRows] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [reportData, setReportData] = useState({ rows: [], count: 0 });

  // Report filters
  const [reportType, setReportType] = useState('freelance_jobs');
  const [reportPackage, setReportPackage] = useState('ALL');
  const [reportSearch, setReportSearch] = useState('');

  // Modals state
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [showRateModal, setShowRateModal] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPreview, setAssignPreview] = useState(null);
  const [showExtraModal, setShowExtraModal] = useState(null); // job object
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(null); // ledger row
  const [selectedPayoutReceipt, setSelectedPayoutReceipt] = useState(null);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState(null);

  // Forms
  const [techForm, setTechForm] = useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    username: '',
    password: '',
    address: '',
    city: 'Colombo',
    skills: 'Inverter Repair, Full Service, Chemical Wash, Gas Charging',
    service_categories: 'Full Service, Normal Cleaning, High Pressure Cleaning, Chemical Cleaning',
    service_areas: 'Colombo, Nugegoda, Dehiwala, Rajagiriya',
    id_number: '',
    id_verification_status: 'VERIFIED',
    bank_name: 'Commercial Bank',
    bank_branch: 'Colombo 03',
    bank_account_name: '',
    bank_account_number: '',
    agreement_status: 'SIGNED',
    availability_status: 'AVAILABLE',
    status: 'ACTIVE',
    notes: ''
  });

  const [rateForm, setRateForm] = useState({
    package_name: 'Full Service',
    technician_id: '',
    technician_fee: 4500,
    commission_type: 'FIXED',
    commission_value: 500,
    commission_base: 'TECHNICIAN_FEE',
    customer_base_price: 5000,
    allow_accept_reject: true,
    effective_date: new Date().toISOString().split('T')[0],
    change_reason: 'Standard rate configuration'
  });

  const [assignForm, setAssignForm] = useState({
    job_id: '',
    technician_id: '',
    package_name: 'Full Service',
    require_offer_acceptance: true,
    customer_discounts: 0,
    custom_technician_fee: '',
    custom_company_commission: ''
  });
  const [assignJobDateFilter, setAssignJobDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'TOMORROW' | 'UNASSIGNED'
  const [assignJobSearch, setAssignJobSearch] = useState('');
  const [scheduleDates, setScheduleDates] = useState(() => {
    const now = new Date();
    const toYmd = d => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const tmrw = new Date(now);
    tmrw.setDate(now.getDate() + 1);
    return { today: toYmd(now), tomorrow: toYmd(tmrw) };
  });

  const [extraForm, setExtraForm] = useState({
    name: '',
    type: 'EXTRA_SERVICE',
    qty: 1,
    cost: 0,
    customer_charge: 1500,
    technician_entitlement: 1000,
    company_commission: 500,
    auto_approve: true,
    notes: ''
  });

  const [payoutForm, setPayoutForm] = useState({
    technician_id: '',
    payout_cycle: 'MONTHLY', // 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL'
    amount: '',
    payment_method: 'BANK_TRANSFER',
    reference_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    auto_approve_pending: true,
    ledger_ids: []
  });
  const [payoutPreview, setPayoutPreview] = useState(null);
  const [payoutPreviewLoading, setPayoutPreviewLoading] = useState(false);
  const [payoutCenterTechId, setPayoutCenterTechId] = useState('');
  const [payoutCenterPreview, setPayoutCenterPreview] = useState(null);
  const [ledgerTechTypeTab, setLedgerTechTypeTab] = useState('FREELANCE'); // 'FREELANCE' | 'COMPANY'

  const [adjustForm, setAdjustForm] = useState({
    approved_adjustments: 0,
    adjustment_notes: '',
    resolve_dispute: false,
    dispute_resolution_notes: ''
  });

  const notify = (msg, type = 'success') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 5000);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qParams = {
        period,
        start_date: startDate,
        end_date: endDate,
        technician_id: selectedTechFilter !== 'ALL' ? selectedTechFilter : undefined
      };

      const [dashRes, techRes, rateRes, ledgerRes, payoutRes, payoutReqRes, assignableJobsRes, jobsRes, compUsersRes, compPkgsRes] = await Promise.all([
        api.get('/freelance/dashboard', { params: qParams }),
        api.get('/freelance/technicians'),
        api.get('/freelance/rate-cards'),
        api.get('/freelance/ledger', { params: qParams }),
        api.get('/freelance/payouts', { params: qParams }),
        api.get('/freelance/payout-requests', { params: qParams }).catch(() => ({ data: { requests: [] } })),
        api.get('/freelance/assignable-jobs').catch(() => ({ data: { jobs: [] } })),
        api.get('/service-jobs').catch(() => ({ data: [] })),
        api.get('/company-admin/users').catch(() => ({ data: [] })),
        api.get('/service-packages').catch(() => ({ data: [] }))
      ]);

      setDashboardData(dashRes.data);

      // Merge Freelance Technicians + Company Technicians so both always appear
      const ftList = Array.isArray(techRes.data?.technicians) ? [...techRes.data.technicians] : [];
      const seenUserIds = new Set(ftList.map(t => Number(t.user_id)));
      const companyUsers = Array.isArray(compUsersRes.data)
        ? compUsersRes.data
        : (compUsersRes.data?.users || []);

      companyUsers.forEach(u => {
        if ((u.role === 'TECHNICIAN' || u.role === 'FREELANCE_TECHNICIAN') && !seenUserIds.has(Number(u.id))) {
          seenUserIds.add(Number(u.id));
          ftList.push({
            id: u.id,
            user_id: u.id,
            technician_type: u.is_freelance || u.role === 'FREELANCE_TECHNICIAN' ? 'FREELANCE' : 'COMPANY',
            technician_code: `${u.is_freelance ? 'FT' : 'CT'}-${String(u.id).padStart(4, '0')}`,
            full_name: u.name,
            phone: u.mobile || '',
            whatsapp: u.mobile || '',
            email: u.email || '',
            skills: ['Full Service', 'Normal Cleaning', 'AC Repair'],
            service_categories: ['Full Service', 'Normal Cleaning'],
            service_areas: ['Colombo'],
            id_verification_status: 'VERIFIED',
            agreement_status: u.is_freelance ? 'SIGNED' : 'COMPANY_STAFF',
            availability_status: 'AVAILABLE',
            status: u.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
            joined_date: String(u.created_at || new Date().toISOString()).slice(0, 10)
          });
        }
      });

      setTechnicians(ftList);
      setRateCards(rateRes.data?.rate_cards || []);

      const rawPkgs = [
        ...(rateRes.data?.packages || []),
        ...(Array.isArray(compPkgsRes.data) ? compPkgsRes.data : (compPkgsRes.data?.packages || []))
      ];
      const uniquePkgs = [];
      const seenPkgNames = new Set();
      rawPkgs.forEach(p => {
        const key = String(p.name || '').trim().toLowerCase();
        if (key && !seenPkgNames.has(key)) {
          seenPkgNames.add(key);
          uniquePkgs.push(p);
        }
      });
      setPackages(uniquePkgs);

      setLedgerRows(ledgerRes.data?.ledger || []);
      setPayouts(payoutRes.data?.payouts || []);
      setPayoutRequests(payoutReqRes.data?.requests || []);

      if (assignableJobsRes.data?.today_date && assignableJobsRes.data?.tomorrow_date) {
        setScheduleDates({
          today: assignableJobsRes.data.today_date,
          tomorrow: assignableJobsRes.data.tomorrow_date
        });
      }
      const assignJobsList = Array.isArray(assignableJobsRes.data?.jobs) && assignableJobsRes.data.jobs.length > 0
        ? assignableJobsRes.data.jobs
        : (Array.isArray(jobsRes.data) ? jobsRes.data : []);
      setAllJobs(assignJobsList);
    } catch (err) {
      console.error('Failed to load freelance commission module:', err);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, selectedTechFilter]);

  const fetchReport = useCallback(async () => {
    try {
      const res = await api.get('/freelance/reports', {
        params: {
          report_type: reportType,
          technician_id: selectedTechFilter !== 'ALL' ? selectedTechFilter : undefined,
          package_name: reportPackage !== 'ALL' ? reportPackage : undefined,
          period,
          start_date: startDate,
          end_date: endDate,
          search: reportSearch
        }
      });
      setReportData(res.data || { rows: [], count: 0 });
    } catch (err) {
      console.error('Report load error:', err);
    }
  }, [reportType, selectedTechFilter, reportPackage, period, startDate, endDate, reportSearch]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReport();
    }
  }, [activeTab, fetchReport]);

  // Unified Service Package Options (combines Rate Cards + Company/Global Service Packages + Standard Defaults + Job Packages)
  const allPackageOptions = (() => {
    const map = new Map();
    const standardFallback = [
      { package_name: 'Full Service', customer_base_price: 5000, technician_fee: 4500, company_commission: 500 },
      { package_name: 'Normal Cleaning', customer_base_price: 3000, technician_fee: 2500, company_commission: 500 },
      { package_name: 'High Pressure Cleaning', customer_base_price: 4500, technician_fee: 3800, company_commission: 700 },
      { package_name: 'Chemical Cleaning', customer_base_price: 7500, technician_fee: 6500, company_commission: 1000 },
      { package_name: 'Gas Charging', customer_base_price: 8500, technician_fee: 7500, company_commission: 1000 },
      { package_name: 'Repair', customer_base_price: 4000, technician_fee: 3400, company_commission: 600 },
      { package_name: 'Installation', customer_base_price: 12000, technician_fee: 10500, company_commission: 1500 }
    ];

    // 1. Default rate cards
    rateCards
      .filter(r => !r.technician_id)
      .forEach(r => {
        const key = String(r.package_name || '').trim().toLowerCase();
        if (key) {
          map.set(key, {
            package_name: r.package_name,
            customer_base_price: Number(r.customer_base_price || 0),
            technician_fee: Number(r.technician_fee || 0),
            company_commission: Number(r.company_commission || 0)
          });
        }
      });

    // 2. Technician-specific override if a technician is selected in assignForm
    if (assignForm.technician_id) {
      rateCards
        .filter(r => Number(r.technician_id) === Number(assignForm.technician_id))
        .forEach(r => {
          const key = String(r.package_name || '').trim().toLowerCase();
          if (key) {
            map.set(key, {
              package_name: r.package_name,
              customer_base_price: Number(r.customer_base_price || 0),
              technician_fee: Number(r.technician_fee || 0),
              company_commission: Number(r.company_commission || 0),
              is_negotiated: true
            });
          }
        });
    }

    // 3. Service packages table
    packages.forEach(p => {
      const key = String(p.name || '').trim().toLowerCase();
      if (key && !map.has(key)) {
        const cp = Number(p.price || 5000);
        const tf = Number(p.technician_fee) > 0 ? Number(p.technician_fee) : Math.round(cp * 0.9);
        const cc = Number(p.company_commission) > 0 ? Number(p.company_commission) : Math.max(0, cp - tf);
        map.set(key, {
          package_name: p.name,
          customer_base_price: cp,
          technician_fee: tf,
          company_commission: cc
        });
      }
    });

    // 4. Standard AC service packages fallback
    standardFallback.forEach(std => {
      const key = std.package_name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, std);
      }
    });

    // 5. Ensure currently selected assignForm.package_name is always in options so select never shows blank
    if (assignForm.package_name) {
      const curKey = String(assignForm.package_name).trim().toLowerCase();
      if (curKey && !map.has(curKey)) {
        map.set(curKey, {
          package_name: assignForm.package_name,
          customer_base_price: Number(assignPreview?.breakdown?.customer_price || 5000),
          technician_fee: Number(assignPreview?.breakdown?.technician_fee || 4500),
          company_commission: Number(assignPreview?.breakdown?.company_commission || 500)
        });
      }
    }

    return Array.from(map.values());
  })();

  const resolveLocalPackageNumbers = (pkgName, techId) => {
    const clean = String(pkgName || 'Full Service').trim().toLowerCase();
    if (techId) {
      const neg = rateCards.find(
        r => Number(r.technician_id) === Number(techId) && String(r.package_name || '').trim().toLowerCase() === clean
      );
      if (neg) {
        return {
          technician_fee: Number(neg.technician_fee || 0),
          company_commission: Number(neg.company_commission || 0),
          customer_price: Number(neg.customer_base_price || 0)
        };
      }
    }
    const opt = allPackageOptions.find(o => String(o.package_name || '').trim().toLowerCase() === clean) || allPackageOptions[0];
    return {
      technician_fee: Number(opt?.technician_fee ?? 4500),
      company_commission: Number(opt?.company_commission ?? 500),
      customer_price: Number(opt?.customer_base_price ?? 5000)
    };
  };

  // Live Rate Card Preview Formula
  const computedRatePreview = (() => {
    const tf = Number(rateForm.technician_fee || 0);
    const cv = Number(rateForm.commission_value || 0);
    if (rateForm.commission_type === 'PERCENTAGE') {
      if (rateForm.commission_base === 'CUSTOMER_PRICE') {
        const cp = Number(rateForm.customer_base_price || 0);
        const comm = Math.round((cp * cv) / 100);
        return { customer_price: cp, technician_fee: cp - comm, company_commission: comm };
      }
      const comm = Math.round((tf * cv) / 100);
      return { customer_price: tf + comm, technician_fee: tf, company_commission: comm };
    }
    return { customer_price: tf + cv, technician_fee: tf, company_commission: cv };
  })();

  const handleSaveTechnician = async e => {
    e.preventDefault();
    try {
      if (editingTech) {
        await api.put(`/freelance/technicians/${editingTech.id}`, techForm);
        notify('Technician profile updated!');
      } else {
        await api.post('/freelance/technicians', techForm);
        notify('New freelance technician onboarded!');
      }
      setShowOnboardModal(false);
      setEditingTech(null);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to save technician', 'error');
    }
  };

  const handleSaveRateCard = async e => {
    e.preventDefault();
    try {
      await api.post('/freelance/rate-cards', {
        ...rateForm,
        customer_base_price: computedRatePreview.customer_price,
        company_commission: computedRatePreview.company_commission
      });
      notify(`Rate card saved: Customer LKR ${computedRatePreview.customer_price.toLocaleString()} = Tech LKR ${computedRatePreview.technician_fee.toLocaleString()} + Commission LKR ${computedRatePreview.company_commission.toLocaleString()}`);
      setShowRateModal(false);
      setEditingRate(null);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to save rate card', 'error');
    }
  };

  const handlePreviewAssignment = async (formOverride = assignForm) => {
    const localNums = resolveLocalPackageNumbers(formOverride.package_name, formOverride.technician_id);
    const effTechFee = formOverride.custom_technician_fee !== '' && formOverride.custom_technician_fee !== undefined
      ? Number(formOverride.custom_technician_fee)
      : localNums.technician_fee;
    const effCompComm = formOverride.custom_company_commission !== '' && formOverride.custom_company_commission !== undefined
      ? Number(formOverride.custom_company_commission)
      : localNums.company_commission;
    const disc = Number(formOverride.customer_discounts || 0);

    // Always set immediate breakdown preview even before job_id is selected
    setAssignPreview({
      breakdown: {
        customer_price: Math.max(0, effTechFee + effCompComm - disc),
        technician_fee: effTechFee,
        company_commission: effCompComm,
        customer_discounts: disc
      }
    });

    if (!formOverride.job_id) return;
    try {
      const res = await api.post(`/freelance/jobs/${formOverride.job_id}/preview-assignment`, formOverride);
      setAssignPreview(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const classifyJobScheduleBucket = jobObj => {
    if (!jobObj) return 'PAST';
    if (jobObj.schedule_bucket) return jobObj.schedule_bucket;
    const ymd = String(jobObj.scheduled_date || '').slice(0, 10);
    if (ymd === scheduleDates.today) return 'TODAY';
    if (ymd === scheduleDates.tomorrow) return 'TOMORROW';
    if (ymd > scheduleDates.tomorrow) return 'UPCOMING';
    return 'PAST';
  };

  const assignJobCounts = (() => {
    let today = 0;
    let tomorrow = 0;
    let unassigned = 0;
    allJobs.forEach(j => {
      const b = classifyJobScheduleBucket(j);
      if (b === 'TODAY') today += 1;
      if (b === 'TOMORROW') tomorrow += 1;
      if (!j.technician_id) unassigned += 1;
    });
    return { all: allJobs.length, today, tomorrow, unassigned };
  })();

  const filteredAssignJobs = allJobs.filter(j => {
    const bucket = classifyJobScheduleBucket(j);
    if (assignJobDateFilter === 'TODAY' && bucket !== 'TODAY') return false;
    if (assignJobDateFilter === 'TOMORROW' && bucket !== 'TOMORROW') return false;
    if (assignJobDateFilter === 'UNASSIGNED' && Boolean(j.technician_id)) return false;

    if (assignJobSearch && assignJobSearch.trim()) {
      const q = assignJobSearch.trim().toLowerCase();
      const hay = `${j.job_number || ''} ${j.customer_name || ''} ${j.customer_phone || ''} ${j.customer_address || ''} ${j.ac_brand || ''} ${j.ac_model || ''} ${j.package_name || ''} ${j.service_type || ''} ${j.scheduled_date || ''} ${j.scheduled_time || ''} ${j.technician_name || ''} ${bucket}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const selectJobInAssignModal = jobObj => {
    if (!jobObj) return;
    const selectedJobId = String(jobObj.id);
    const jobPkg = jobObj?.package_name || jobObj?.service_type || assignForm.package_name || 'Full Service';
    const jobTechId = jobObj?.technician_id
      ? String(jobObj.technician_id)
      : (assignForm.technician_id || (technicians[0]?.user_id ? String(technicians[0].user_id) : ''));
    const nums = resolveLocalPackageNumbers(jobPkg, jobTechId);
    const next = {
      ...assignForm,
      job_id: selectedJobId,
      technician_id: jobTechId,
      package_name: jobPkg,
      custom_technician_fee: nums.technician_fee,
      custom_company_commission: nums.company_commission
    };
    setAssignForm(next);
    handlePreviewAssignment(next);
  };

  const openAssignModalWithDefaults = (preselectedJob = null) => {
    setAssignJobDateFilter('ALL');
    setAssignJobSearch('');
    const initialJob =
      preselectedJob ||
      allJobs.find(j => classifyJobScheduleBucket(j) === 'TODAY') ||
      allJobs.find(j => classifyJobScheduleBucket(j) === 'TOMORROW') ||
      allJobs[0] ||
      null;
    const defaultPkg = initialJob?.package_name || initialJob?.service_type || allPackageOptions[0]?.package_name || 'Full Service';
    const defaultTechId = initialJob?.technician_id
      ? String(initialJob.technician_id)
      : (technicians[0]?.user_id ? String(technicians[0].user_id) : '');
    const nums = resolveLocalPackageNumbers(defaultPkg, defaultTechId);
    const nextForm = {
      job_id: initialJob?.id ? String(initialJob.id) : '',
      technician_id: defaultTechId,
      package_name: defaultPkg,
      require_offer_acceptance: true,
      customer_discounts: 0,
      custom_technician_fee: nums.technician_fee,
      custom_company_commission: nums.company_commission
    };
    setAssignForm(nextForm);
    setShowAssignModal(true);
    handlePreviewAssignment(nextForm);
  };

  const handleConfirmAssignment = async e => {
    e.preventDefault();
    if (!assignForm.job_id || !assignForm.technician_id) {
      return notify('Select both a service job and a technician', 'error');
    }
    try {
      await api.post(`/freelance/jobs/${assignForm.job_id}/assign`, assignForm);
      notify('Service job assigned and technician notified!');
      setShowAssignModal(false);
      setAssignPreview(null);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to assign job', 'error');
    }
  };

  const handleRespondOffer = async (jobId, action) => {
    const reason = action === 'REJECT' ? window.prompt('Reason for rejecting this job offer:', 'Schedule conflict') : '';
    if (action === 'REJECT' && reason === null) return;
    try {
      await api.post(`/freelance/jobs/${jobId}/respond-offer`, { action, rejection_reason: reason || '' });
      notify(`Job offer ${action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'}!`);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to respond to offer', 'error');
    }
  };

  const handleWorkflowTransition = async (jobId, nextStatus) => {
    try {
      await api.post(`/freelance/jobs/${jobId}/workflow`, {
        workflow_status: nextStatus,
        work_performed: nextStatus === 'COMPLETED' ? 'Completed full service checklist and pressure check.' : undefined
      });
      notify(`Job workflow updated to ${nextStatus}`);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Workflow update failed', 'error');
    }
  };

  const handleGenerateInvoice = async jobId => {
    try {
      const res = await api.post(`/freelance/jobs/${jobId}/generate-invoice`, {});
      notify(`Customer Invoice ${res.data?.invoice?.invoice_number} generated for LKR ${Number(res.data?.invoice?.total || 0).toLocaleString()}!`);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to generate invoice', 'error');
    }
  };

  const handleAddExtraWork = async e => {
    e.preventDefault();
    if (!showExtraModal) return;
    try {
      await api.post(`/freelance/jobs/${showExtraModal.job_id || showExtraModal.id}/extras`, extraForm);
      notify('Extra work item recorded and financials recalculated!');
      setShowExtraModal(null);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to add extra work', 'error');
    }
  };

  const handleLedgerStatusChange = async (ledgerId, payment_status) => {
    let dispute_reason = '';
    if (payment_status === 'DISPUTED') {
      dispute_reason = window.prompt('Enter dispute reason for audit trail:', 'Customer reported incomplete coil wash') || '';
      if (!dispute_reason) return;
    }
    try {
      await api.post(`/freelance/ledger/${ledgerId}/status`, { payment_status, dispute_reason });
      notify(`Ledger status updated to ${payment_status}`);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to change ledger status', 'error');
    }
  };

  const handleSaveAdjustment = async e => {
    e.preventDefault();
    if (!showAdjustModal) return;
    try {
      await api.post(`/freelance/ledger/${showAdjustModal.id}/adjustment`, adjustForm);
      notify('Ledger adjustment saved with audit trail!');
      setShowAdjustModal(null);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to save adjustment', 'error');
    }
  };

  const loadPayoutPreviewForTech = useCallback(async (techUserId, preferredCycle = null, isForCenter = false) => {
    if (!techUserId) {
      if (isForCenter) setPayoutCenterPreview(null);
      else setPayoutPreview(null);
      return;
    }
    if (!isForCenter) setPayoutPreviewLoading(true);
    try {
      const res = await api.get('/freelance/payouts/preview', {
        params: { technician_id: techUserId }
      });
      const preview = res.data;
      if (isForCenter) {
        setPayoutCenterPreview(preview);
      } else {
        setPayoutPreview(preview);
        const cycles = preview?.cycles || {};
        let chosenCycle = preferredCycle;
        if (!chosenCycle) {
          if (Number(cycles.DAILY?.total_unpaid_balance || 0) > 0) chosenCycle = 'DAILY';
          else if (Number(cycles.WEEKLY?.total_unpaid_balance || 0) > 0) chosenCycle = 'WEEKLY';
          else if (Number(cycles.MONTHLY?.total_unpaid_balance || 0) > 0) chosenCycle = 'MONTHLY';
          else chosenCycle = 'ALL';
        }
        const cycleData = cycles[chosenCycle] || cycles.ALL || {};
        setPayoutForm(prev => ({
          ...prev,
          technician_id: String(techUserId),
          payout_cycle: chosenCycle,
          amount: Number(cycleData.total_unpaid_balance || 0) > 0 ? String(cycleData.total_unpaid_balance) : '',
          ledger_ids: (cycleData.unpaid_items || []).map(i => i.id)
        }));
      }
    } catch (err) {
      console.error('Failed to load payout preview:', err);
    } finally {
      if (!isForCenter) setPayoutPreviewLoading(false);
    }
  }, []);

  const selectPayoutCycle = (cycleKey, previewObj = payoutPreview) => {
    const cycleData = previewObj?.cycles?.[cycleKey] || {};
    const items = cycleData.unpaid_items || [];
    const totalAmt = Number(cycleData.total_unpaid_balance || 0);
    setPayoutForm(prev => ({
      ...prev,
      payout_cycle: cycleKey,
      amount: totalAmt > 0 ? String(totalAmt) : '',
      ledger_ids: items.map(i => i.id)
    }));
  };

  const togglePayoutLedgerItem = item => {
    setPayoutForm(prev => {
      const currentIds = Array.isArray(prev.ledger_ids) ? prev.ledger_ids : [];
      const exists = currentIds.includes(item.id);
      const nextIds = exists ? currentIds.filter(id => id !== item.id) : [...currentIds, item.id];
      const cycleItems = payoutPreview?.cycles?.[prev.payout_cycle]?.unpaid_items || [];
      const nextSum = cycleItems
        .filter(ci => nextIds.includes(ci.id))
        .reduce((s, ci) => s + Number(ci.balance_payable || 0), 0);
      return {
        ...prev,
        ledger_ids: nextIds,
        amount: nextSum > 0 ? String(Math.round(nextSum * 100) / 100) : ''
      };
    });
  };

  const freelanceOnlyTechnicians = technicians.filter(
    t => t.technician_type === 'FREELANCE' || Boolean(t.is_freelance || t.ft_id)
  );

  const isLedgerRowFreelance = useCallback(
    l => {
      if (l.technician_type) return l.technician_type === 'FREELANCE';
      if (l.ft_id || l.is_freelance) return true;
      const matchTech = technicians.find(t => Number(t.user_id) === Number(l.technician_id));
      return matchTech ? matchTech.technician_type === 'FREELANCE' : false;
    },
    [technicians]
  );

  const freelanceLedgerRows = ledgerRows.filter(l => isLedgerRowFreelance(l));
  const companyLedgerRows = ledgerRows.filter(l => !isLedgerRowFreelance(l));

  const openPayoutModalForTechnician = (techUserId, preferredCycle = null) => {
    const validFreelancer = freelanceOnlyTechnicians.find(t => String(t.user_id) === String(techUserId));
    const defaultFreelancer =
      validFreelancer ||
      freelanceOnlyTechnicians.find(t => Number(t.balance_payable || 0) > 0) ||
      freelanceOnlyTechnicians[0];
    const resolvedTechId = defaultFreelancer?.user_id ? String(defaultFreelancer.user_id) : '';

    setShowPayoutModal(true);
    setPayoutForm(prev => ({
      ...prev,
      technician_id: resolvedTechId,
      payout_cycle: preferredCycle || 'MONTHLY',
      amount: '',
      ledger_ids: [],
      auto_approve_pending: true
    }));
    if (resolvedTechId) {
      loadPayoutPreviewForTech(resolvedTechId, preferredCycle, false);
    } else {
      setPayoutPreview(null);
    }
  };

  useEffect(() => {
    const flList = technicians.filter(t => t.technician_type === 'FREELANCE' || Boolean(t.is_freelance || t.ft_id));
    if (payoutCenterTechId && flList.some(t => String(t.user_id) === String(payoutCenterTechId))) {
      loadPayoutPreviewForTech(payoutCenterTechId, null, true);
    } else if (flList.length > 0) {
      const firstWithBalance = flList.find(t => Number(t.balance_payable || 0) > 0) || flList[0];
      if (firstWithBalance?.user_id) {
        setPayoutCenterTechId(String(firstWithBalance.user_id));
      }
    } else {
      setPayoutCenterPreview(null);
    }
  }, [payoutCenterTechId, technicians, loadPayoutPreviewForTech]);

  const handleRecordPayout = async e => {
    e.preventDefault();
    try {
      const res = await api.post('/freelance/payouts', payoutForm);
      notify(res.data?.message || 'Technician payout recorded!');
      setShowPayoutModal(false);
      setPayoutForm({
        technician_id: '',
        payout_cycle: 'MONTHLY',
        amount: '',
        payment_method: 'BANK_TRANSFER',
        reference_number: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
        auto_approve_pending: true,
        ledger_ids: []
      });
      setPayoutPreview(null);
      fetchAll();
      if (payoutCenterTechId) {
        loadPayoutPreviewForTech(payoutCenterTechId, null, true);
      }
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to record payout', 'error');
    }
  };

  const exportReportCsv = () => {
    const rows = reportData.rows || [];
    if (rows.length === 0) return notify('No rows to export', 'error');
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(r =>
        headers
          .map(h => {
            const val = r[h] === null || r[h] === undefined ? '' : String(r[h]).replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(',')
      )
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACPro_Freelance_${reportType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const compDash = dashboardData?.company_dashboard || {};
  const techDash = dashboardData?.technician_dashboard || {};
  const isCurrentUserFreelancer = true;

  const handleQuickRequestPayout = async (cycle = 'MONTHLY', techIdOverride = null) => {
    try {
      const targetId = techIdOverride || (selectedTechFilter !== 'ALL' ? selectedTechFilter : (payoutCenterTechId || undefined));
      const res = await api.post('/freelance/payout-requests', {
        technician_id: targetId ? Number(targetId) : undefined,
        payout_cycle: cycle,
        preferred_method: 'BANK_TRANSFER'
      });
      notify(res.data?.message || `${cycle} Payout Request submitted!`);
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to submit payout request', 'error');
    }
  };

  const handleApprovePayoutRequest = async (reqId) => {
    try {
      const res = await api.post(`/freelance/payout-requests/${reqId}/approve`, {
        payment_method: 'BANK_TRANSFER'
      });
      notify(res.data?.message || 'Payout request approved and paid!');
      fetchAll();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to approve payout request', 'error');
    }
  };

  const renderPayoutRequestsSection = () => (
    <div className="bg-white rounded-2xl border-2 border-purple-300 shadow-2xs overflow-hidden">
      <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-900 via-[#423A8E] to-indigo-900 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#00CCCD] text-slate-950 text-[10px] font-black uppercase">
              FREELANCE PAYOUT REQUESTS (DAILY · WEEKLY · MONTHLY)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/15 text-white text-[10px] font-black">
              {payoutRequests.filter(r => r.status === 'PENDING').length} Pending · {payoutRequests.length} Total
            </span>
          </div>
          <h3 className="text-base font-black mt-1">
            Freelance Technician Requested Payouts (From Mobile App & Dashboard)
          </h3>
          <p className="text-xs text-purple-200">
            All Daily, Weekly, and Monthly payout requests submitted by Freelance Technicians appear here for instant review & settlement.
          </p>
        </div>

        {/* Quick Request Payout Buttons (Daily / Weekly / Monthly) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickRequestPayout('DAILY')}
            className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1 shadow-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Request Daily Payout
          </button>
          <button
            type="button"
            onClick={() => handleQuickRequestPayout('WEEKLY')}
            className="px-3 py-2 rounded-xl bg-[#00CCCD] hover:brightness-105 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Request Weekly Payout
          </button>
          <button
            type="button"
            onClick={() => handleQuickRequestPayout('MONTHLY')}
            className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Request Monthly Payout
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-purple-50 text-[10px] font-black uppercase text-purple-900 border-b border-purple-200">
            <tr>
              <th className="p-3">Request #</th>
              <th className="p-3">Freelance Technician</th>
              <th className="p-3 text-center">Cycle (Daily / Weekly / Monthly)</th>
              <th className="p-3 text-center">Jobs</th>
              <th className="p-3 text-right">Requested Amount</th>
              <th className="p-3">Preferred Method</th>
              <th className="p-3">Requested At</th>
              <th className="p-3 text-center">Status</th>
              {!isTech && <th className="p-3 text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payoutRequests.length === 0 ? (
              <tr>
                <td colSpan={isTech ? 8 : 9} className="p-6 text-center text-slate-400 font-semibold">
                  No payout requests yet. Click "Request Daily Payout", "Request Weekly Payout", or "Request Monthly Payout" above (or in the Mobile Field App) to submit a request.
                </td>
              </tr>
            ) : (
              payoutRequests.map(reqItem => (
                <tr key={`payout-req-${reqItem.id}`} className="hover:bg-purple-50/40">
                  <td className="p-3 font-mono font-black text-purple-900">{reqItem.request_number}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{reqItem.technician_name}</div>
                    <div className="text-[10px] text-purple-700 font-bold">
                      {reqItem.technician_code || `FT-${String(reqItem.technician_id).padStart(4, '0')}`}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        reqItem.payout_cycle === 'DAILY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : reqItem.payout_cycle === 'WEEKLY'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {reqItem.payout_cycle} PAYOUT
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-slate-700">{reqItem.jobs_count || 1} Job(s)</td>
                  <td className="p-3 text-right font-black text-emerald-700 text-sm">
                    Rs. {Number(reqItem.requested_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-3 font-semibold text-slate-700">{reqItem.preferred_method || 'BANK_TRANSFER'}</td>
                  <td className="p-3 text-[11px] text-slate-500">
                    {String(reqItem.requested_at || '').slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        reqItem.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {reqItem.status === 'PAID' ? `PAID (${reqItem.payout_number || 'SETTLED'})` : reqItem.status}
                    </span>
                  </td>
                  {!isTech && (
                    <td className="p-3 text-right">
                      {reqItem.status !== 'PAID' ? (
                        <button
                          type="button"
                          onClick={() => handleApprovePayoutRequest(reqItem.id)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black shadow-xs cursor-pointer"
                        >
                          Approve & Pay Now
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700">Settled ✓</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#423A8E] via-[#2E276D] to-[#19153E] text-white p-6 rounded-3xl shadow-xl border border-indigo-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00CCCD] text-slate-950 flex items-center gap-1">
              <Briefcase className="w-3 h-3" /> FREELANCE COMMISSION ENGINE
            </span>
            <span className="text-xs text-slate-300 font-semibold">
              Multi-Tenant Per-Job Earnings & Split-Commission Ledger
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            {isTech ? 'My Freelance Jobs, Commissions & Payouts' : 'Freelance Technician Commission & Earnings Management'}
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Formula Verified on Backend: <code className="text-[#00CCCD] font-mono">customer_price = technician_fee + company_commission + approved_extras - discounts</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isTech && isCurrentUserFreelancer && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickRequestPayout('DAILY')}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Request Daily Payout
              </button>
              <button
                type="button"
                onClick={() => handleQuickRequestPayout('WEEKLY')}
                className="px-3 py-2 rounded-xl bg-[#00CCCD] hover:brightness-105 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Request Weekly Payout
              </button>
              <button
                type="button"
                onClick={() => handleQuickRequestPayout('MONTHLY')}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black flex items-center gap-1 shadow-md cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Request Monthly Payout
              </button>
            </div>
          )}
          {!isTech && (
            <>
              <button
                onClick={() => {
                  setEditingTech(null);
                  setShowOnboardModal(true);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#00CCCD]" /> Onboard Freelancer
              </button>
              <button
                onClick={() => setShowRateModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-amber-300" /> Configure Rate Card
              </button>
              <button
                onClick={() => openAssignModalWithDefaults()}
                className="px-4 py-2.5 rounded-xl bg-[#00CCCD] hover:brightness-105 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Wrench className="w-4 h-4" /> Assign Service Job
              </button>
              <button
                onClick={() => openPayoutModalForTechnician(selectedTechFilter !== 'ALL' ? selectedTechFilter : (payoutCenterTechId || ''))}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <CreditCard className="w-4 h-4" /> Record Payout (Daily / Weekly / Monthly)
              </button>
            </>
          )}
          <button
            onClick={fetchAll}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs & Date Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(isTech
            ? [
                { id: 'workflow', label: '1. My Job Tasks & Offers', icon: Wrench },
                { id: 'dashboard', label: '2. Dashboard Overview', icon: TrendingUp },
                { id: 'ledger', label: '3. Earnings & Payouts', icon: DollarSign },
                { id: 'technicians', label: '4. My Freelance Profile', icon: Users },
                { id: 'rates', label: '5. Package Rate Cards', icon: Sliders },
                { id: 'reports', label: '6. Reports & Exports', icon: FileText }
              ]
            : [
                { id: 'dashboard', label: 'Dashboard Overview', icon: TrendingUp },
                { id: 'technicians', label: 'Freelance Technicians', icon: Users },
                { id: 'rates', label: 'Package Rate Cards', icon: Sliders },
                { id: 'workflow', label: 'Job Offers & Workflow', icon: Wrench },
                { id: 'ledger', label: 'Earnings Ledger & Payouts', icon: DollarSign },
                { id: 'reports', label: 'Reports & Exports', icon: FileText }
              ]
          ).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#423A8E] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date & Technician Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                  period === p.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-xs"
              />
            </div>
          )}

          {!isTech && (
            <select
              value={selectedTechFilter}
              onChange={e => setSelectedTechFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
            >
              <option value="ALL">All Technicians (Freelance + Company)</option>
              {technicians.map(t => (
                <option key={`tech-filter-${t.user_id || t.id}`} value={t.user_id}>
                  {t.full_name} ({t.technician_code}) — {t.technician_type === 'COMPANY' ? 'Company Tech' : 'Freelancer'}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {!isTech ? (
            <>
              {/* Company Admin KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Active Technicians</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    {compDash.active_freelance_technicians || technicians.length || 0}
                  </p>
                  <span className="text-[11px] text-emerald-600 font-bold">
                    {compDash.jobs_assigned_to_freelancers || 0} Jobs Assigned ({compDash.jobs_completed || 0} Done)
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400">Customer Revenue</span>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    Rs. {Number(compDash.customer_revenue || 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-sky-600 font-bold">
                    Collected: Rs. {Number(compDash.customer_collected || 0).toLocaleString()} (Due: Rs.{' '}
                    {Number(compDash.customer_balances_outstanding || 0).toLocaleString()})
                  </span>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-4 rounded-2xl border border-indigo-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-indigo-900">Gross Company Commission</span>
                  <p className="text-2xl font-black text-indigo-950 mt-1">
                    Rs. {Number(compDash.company_commission_earned || 0).toLocaleString()}
                  </p>
                  <span className="text-[10px] text-indigo-700 font-bold block">
                    Recognized (Collected): Rs. {Number(compDash.commission_recognized || 0).toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-500 italic">
                    *Gross commission before company overheads/taxes
                  </span>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4 rounded-2xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-emerald-900">Tech Earnings Accrued</span>
                  <p className="text-2xl font-black text-emerald-950 mt-1">
                    Rs. {Number(compDash.technician_earnings_accrued || 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-emerald-700 font-bold">
                    Payouts Made: Rs. {Number(compDash.technician_payouts_made || 0).toLocaleString()}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 rounded-2xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-amber-900">Outstanding Tech Payable</span>
                  <p className="text-2xl font-black text-amber-950 mt-1">
                    Rs. {Number(compDash.outstanding_technician_payable || 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-amber-800 font-bold">
                    Unpaid Balance to Technicians
                  </span>
                </div>
              </div>

              {/* Breakdown by Package & Technician */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Commission & Revenue by Service Package</h3>
                      <p className="text-[11px] text-slate-500">
                        Live breakdown of customer revenue, technician fees, and company commission by package
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black">
                      {(compDash.commission_by_package || []).length} Packages
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-3">Package</th>
                          <th className="p-3 text-center">Jobs</th>
                          <th className="p-3 text-right">Customer Price</th>
                          <th className="p-3 text-right">Tech Earnings</th>
                          <th className="p-3 text-right">Company Comm.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(compDash.commission_by_package || []).length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-slate-400 font-semibold">
                              No service package job data in selected period.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {(compDash.commission_by_package || []).map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-900">{row.package_name}</td>
                                <td className="p-3 text-center">
                                  <span className="font-black text-slate-900">{row.jobs_count}</span>
                                  {row.completed_jobs_count !== undefined && (
                                    <span className="block text-[10px] text-emerald-600 font-bold">
                                      {row.completed_jobs_count} Done
                                      {row.active_jobs_count > 0 ? ` · ${row.active_jobs_count} Active` : ''}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-semibold">
                                  Rs. {Number(row.customer_revenue || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-bold text-emerald-700">
                                  Rs. {Number(row.technician_earnings || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-black text-indigo-700">
                                  Rs. {Number(row.company_commission || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50/90 font-black border-t-2 border-slate-200">
                              <td className="p-3 text-slate-900">TOTAL</td>
                              <td className="p-3 text-center text-slate-900">
                                {(compDash.commission_by_package || []).reduce((s, r) => s + Number(r.jobs_count || 0), 0)}
                              </td>
                              <td className="p-3 text-right text-slate-900">
                                Rs.{' '}
                                {(compDash.commission_by_package || [])
                                  .reduce((s, r) => s + Number(r.customer_revenue || 0), 0)
                                  .toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-emerald-700">
                                Rs.{' '}
                                {(compDash.commission_by_package || [])
                                  .reduce((s, r) => s + Number(r.technician_earnings || 0), 0)
                                  .toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-indigo-700">
                                Rs.{' '}
                                {(compDash.commission_by_package || [])
                                  .reduce((s, r) => s + Number(r.company_commission || 0), 0)
                                  .toLocaleString()}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Earnings & Payable Balance by Technician</h3>
                      <p className="text-[11px] text-slate-500">
                        Accrued fees, payouts made, and unpaid payable balances across Freelance & Company Technicians
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black">
                      {(compDash.earnings_by_technician || []).length} Technicians
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-3">Technician</th>
                          <th className="p-3 text-center">Jobs</th>
                          <th className="p-3 text-right">Accrued</th>
                          <th className="p-3 text-right">Paid</th>
                          <th className="p-3 text-right">Payable Due</th>
                          <th className="p-3 text-center">Payout</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(compDash.earnings_by_technician || []).length === 0 ? (
                          <tr>
                            <td colSpan="6" className="p-6 text-center text-slate-400 font-semibold">
                              No technician earnings recorded yet.
                            </td>
                          </tr>
                        ) : (
                          <>
                            {(compDash.earnings_by_technician || []).map(row => (
                              <tr
                                key={`tech-earn-${row.technician_id}`}
                                onClick={() =>
                                  setSelectedTechFilter(
                                    String(selectedTechFilter) === String(row.technician_id)
                                      ? 'ALL'
                                      : String(row.technician_id)
                                  )
                                }
                                className="hover:bg-slate-50 cursor-pointer transition-colors"
                                title="Click to filter dashboard by this technician"
                              >
                                <td className="p-3">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{row.technician_name}</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                        row.technician_type === 'COMPANY'
                                          ? 'bg-sky-100 text-sky-700'
                                          : 'bg-purple-100 text-purple-700'
                                      }`}
                                    >
                                      {row.technician_type === 'COMPANY' ? 'Company' : 'Freelance'}
                                    </span>
                                  </div>
                                  {row.technician_code && (
                                    <span className="text-[10px] text-slate-400 font-mono">{row.technician_code}</span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className="font-black text-slate-900">
                                    {row.jobs_completed || 0} Done
                                  </span>
                                  {row.jobs_assigned > 0 && (
                                    <span className="block text-[10px] text-slate-500 font-semibold">
                                      of {row.jobs_assigned} Assigned
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-bold text-slate-800">
                                  Rs. {Number(row.earnings_accrued || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-bold text-emerald-700">
                                  Rs. {Number(row.amount_paid || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-black text-amber-700">
                                  Rs. {Number(row.balance_payable || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  {row.technician_type !== 'COMPANY' ? (
                                    <button
                                      type="button"
                                      onClick={() => openPayoutModalForTechnician(row.technician_id)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                                    >
                                      Pay Freelancer
                                    </button>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-bold">
                                      Company Staff
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50/90 font-black border-t-2 border-slate-200">
                              <td className="p-3 text-slate-900">TOTAL</td>
                              <td className="p-3 text-center text-slate-900">
                                {(compDash.earnings_by_technician || []).reduce((s, r) => s + Number(r.jobs_completed || 0), 0)} Done
                              </td>
                              <td className="p-3 text-right text-slate-900">
                                Rs.{' '}
                                {(compDash.earnings_by_technician || [])
                                  .reduce((s, r) => s + Number(r.earnings_accrued || 0), 0)
                                  .toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-emerald-700">
                                Rs.{' '}
                                {(compDash.earnings_by_technician || [])
                                  .reduce((s, r) => s + Number(r.amount_paid || 0), 0)
                                  .toLocaleString()}
                              </td>
                              <td className="p-3 text-right text-amber-700">
                                Rs.{' '}
                                {(compDash.earnings_by_technician || [])
                                  .reduce((s, r) => s + Number(r.balance_payable || 0), 0)
                                  .toLocaleString()}
                              </td>
                              <td className="p-3"></td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {/* Freelance Technician Payout Requests (Daily / Weekly / Monthly) */}
          {renderPayoutRequestsSection()}

          {/* Freelance Technician Dashboard Cards (Always shown to Tech, and shown below for Admin) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Freelance Technician Earnings & Job Status Summary</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">
                  Total Accrued: <strong className="text-slate-900">Rs. {Number(techDash.total_earnings || 0).toLocaleString()}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-[11px] font-bold text-amber-700">
                  Balance Due: <strong>Rs. {Number(techDash.outstanding_balance || 0).toLocaleString()}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Offered Jobs</span>
                <p className="text-xl font-black text-indigo-700 mt-0.5">
                  {techDash.available_offered_jobs_count || 0}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Upcoming / Active</span>
                <p className="text-xl font-black text-sky-700 mt-0.5">
                  {techDash.upcoming_jobs_count || 0}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Completed Jobs</span>
                <p className="text-xl font-black text-emerald-700 mt-0.5">
                  {techDash.completed_jobs_count || 0}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[10px] font-bold uppercase text-amber-800">Pending Approval</span>
                <p className="text-lg font-black text-amber-900 mt-0.5">
                  Rs. {Number(techDash.pending_earnings || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-emerald-800">Approved Payable</span>
                <p className="text-lg font-black text-emerald-900 mt-0.5">
                  Rs. {Number(techDash.approved_payable_earnings || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <span className="text-[10px] font-bold uppercase text-indigo-800">Total Paid Out</span>
                <p className="text-lg font-black text-indigo-900 mt-0.5">
                  Rs. {Number(techDash.amount_paid || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Live Job Status Breakdown Table inside Summary */}
            {([...(techDash.upcoming_jobs || []), ...(techDash.completed_jobs || [])].length > 0) && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-700">
                    Recent Assigned & Completed Technician Jobs ({[...(techDash.upcoming_jobs || []), ...(techDash.completed_jobs || [])].length})
                  </span>
                  <button
                    onClick={() => setActiveTab('workflow')}
                    className="text-xs font-bold text-[#423A8E] hover:underline cursor-pointer"
                  >
                    Manage All Workflow & Offers →
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Job #</th>
                        <th className="p-2.5">Customer & AC</th>
                        <th className="p-2.5">Technician</th>
                        <th className="p-2.5">Package</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Customer Price</th>
                        <th className="p-2.5 text-right">Tech Earnings</th>
                        {!isTech && <th className="p-2.5 text-right">Commission</th>}
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...(techDash.upcoming_jobs || []), ...(techDash.completed_jobs || [])]
                        .slice(0, 12)
                        .map(job => (
                          <tr key={`sum-job-${job.id}-${job.job_id}`} className="hover:bg-slate-50">
                            <td className="p-2.5 font-black text-slate-900">{job.job_number}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-slate-800">{job.customer_name}</div>
                              <div className="text-[10px] text-slate-500">
                                {job.ac_brand} · {job.scheduled_date}
                              </div>
                            </td>
                            <td className="p-2.5 font-bold text-slate-800">{job.technician_name}</td>
                            <td className="p-2.5 font-semibold text-indigo-900">{job.package_name || job.service_type}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  ['COMPLETED', 'CLOSED', 'AWAITING_PAYMENT_APPROVAL'].includes(job.workflow_status)
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : job.workflow_status === 'OFFERED'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                {job.workflow_status}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-semibold text-slate-900">
                              Rs. {Number(job.final_customer_price || 0).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right font-black text-emerald-700">
                              Rs. {Number(job.final_technician_earnings || 0).toLocaleString()}
                            </td>
                            {!isTech && (
                              <td className="p-2.5 text-right font-black text-indigo-700">
                                Rs. {Number(job.final_company_commission || 0).toLocaleString()}
                              </td>
                            )}
                            <td className="p-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setSelectedJobForDetail({ id: job.job_id })}
                                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" /> View
                                </button>
                                {!['COMPLETED', 'CLOSED', 'AWAITING_PAYMENT_APPROVAL'].includes(job.workflow_status) && (
                                  <button
                                    onClick={() => handleWorkflowTransition(job.job_id, 'COMPLETED')}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FREELANCE TECHNICIANS ONBOARDING & REGISTRY */}
      {activeTab === 'technicians' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">Freelance Technicians Registry</h3>
              <p className="text-xs text-slate-500">
                Verified contractors with bank details protection, agreement status, and service area coverage.
              </p>
            </div>
            {!isTech && (
              <button
                onClick={() => {
                  setEditingTech(null);
                  setShowOnboardModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Onboard Technician
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Tech ID & Name</th>
                  <th className="p-3.5">Contact & Areas</th>
                  <th className="p-3.5">Skills & Categories</th>
                  <th className="p-3.5">Verification & Contract</th>
                  <th className="p-3.5">Bank / Payment Info</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Payable Balance</th>
                  <th className="p-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {technicians.map(t => (
                  <tr key={`tech-row-${t.user_id || t.id}`} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {t.technician_code}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            t.technician_type === 'COMPANY'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {t.technician_type === 'COMPANY' ? 'Company Tech' : 'Freelance Tech'}
                        </span>
                      </div>
                      <p className="font-black text-slate-900 mt-1">{t.full_name}</p>
                      <p className="text-[10px] text-slate-400">Joined: {t.joined_date || 'N/A'}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-800">{t.phone}</p>
                      <p className="text-[11px] text-slate-500">{t.email}</p>
                      <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                        Areas: {(t.service_areas || []).join(', ') || 'All Areas'}
                      </p>
                    </td>
                    <td className="p-3.5 max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {(t.skills || []).map((sk, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.id_verification_status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          ID: {t.id_verification_status}
                        </span>
                        <span className="block text-[10px] font-bold text-slate-600">
                          Contract: {t.agreement_status}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-800">{t.bank_name || 'Not set'}</p>
                      <p className="font-mono text-[11px] text-slate-600 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        {t.bank_account_number || 'N/A'}
                      </p>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (t.status === 'SUSPENDED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-1">{t.availability_status}</span>
                    </td>
                    <td className="p-3.5 text-right">
                      <p className="font-black text-slate-900">
                        Rs. {Number(t.balance_payable || 0).toLocaleString()}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        Paid: Rs. {Number(t.amount_paid || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isTech && t.technician_type !== 'COMPANY' && (
                          <button
                            type="button"
                            onClick={() => openPayoutModalForTechnician(t.user_id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            Pay
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingTech(t);
                            setTechForm({
                              ...t,
                              skills: (t.skills || []).join(', '),
                              service_categories: (t.service_categories || []).join(', '),
                              service_areas: (t.service_areas || []).join(', ')
                            });
                            setShowOnboardModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: SERVICE PACKAGE RATE CARDS */}
      {activeTab === 'rates' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Service Package Freelance Rate Cards & Negotiated Rates
              </h3>
              <p className="text-xs text-slate-500">
                Configure Customer Base Price, Freelance Technician Fee, and Company Commission (Fixed or Percentage) per package or technician.
              </p>
            </div>
            {!isTech && (
              <button
                onClick={() => setShowRateModal(true)}
                className="px-4 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Configure Package Rate
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Service Package</th>
                  <th className="p-3.5">Scope / Technician</th>
                  <th className="p-3.5 text-right">Technician Agreed Fee</th>
                  <th className="p-3.5 text-right">Company Commission</th>
                  <th className="p-3.5 text-right">Customer Base Price</th>
                  <th className="p-3.5 text-center">Commission Type</th>
                  <th className="p-3.5 text-center">Accept/Reject</th>
                  <th className="p-3.5">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rateCards.map(rc => (
                  <tr key={rc.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-black text-slate-900">{rc.package_name}</td>
                    <td className="p-3.5">
                      {rc.technician_id ? (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                          Negotiated: {rc.technician_name || `Tech #${rc.technician_id}`}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold text-[10px]">
                          Company Default Rate
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-700">
                      Rs. {Number(rc.technician_fee || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-right font-black text-indigo-700">
                      { isTech ? '—' : `Rs. ${Number(rc.company_commission || 0).toLocaleString()}` }
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900">
                      Rs. {Number(rc.customer_base_price || 0).toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center font-semibold text-slate-600">
                      {rc.commission_type} {rc.commission_type === 'PERCENTAGE' ? `(${rc.commission_value}% of ${rc.commission_base})` : ''}
                    </td>
                    <td className="p-3.5 text-center">
                      {rc.allow_accept_reject ? (
                        <span className="text-emerald-600 font-bold">Allowed</span>
                      ) : (
                        <span className="text-slate-400">Direct</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-600">{rc.effective_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: JOB OFFERS & WORKFLOW */}
      {activeTab === 'workflow' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">
                Freelance Job Assignments, Offers & Field Workflow
              </h3>
              <p className="text-xs text-slate-500">
                Lifecycle: Assigned → Offered → Accepted → On The Way → In Progress → Completed → Awaiting Payment/Approval → Closed
              </p>
            </div>
            {!isTech && (
              <button
                onClick={() => openAssignModalWithDefaults()}
                className="px-4 py-2 rounded-xl bg-[#00CCCD] text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-4 h-4" /> Assign Job to Technician
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Job # & Date</th>
                  <th className="p-3.5">Customer & Unit</th>
                  <th className="p-3.5">Technician</th>
                  <th className="p-3.5">Package</th>
                  <th className="p-3.5 text-right">Customer Price</th>
                  <th className="p-3.5 text-right">Agreed Tech Fee</th>
                  <th className="p-3.5 text-center">Workflow Status</th>
                  <th className="p-3.5 text-center">Workflow & Billing Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  ...(techDash.offered_jobs || []),
                  ...(techDash.upcoming_jobs || []),
                  ...(techDash.completed_jobs || [])
                ]
                  .filter((v, i, a) => a.findIndex(t => t.job_id === v.job_id) === i)
                  .map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3.5">
                        <button
                          onClick={() => setSelectedJobForDetail({ id: item.job_id, job_number: item.job_number })}
                          className="font-mono font-black text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {item.job_number} <Eye className="w-3 h-3" />
                        </button>
                        <span className="block text-[10px] text-slate-400">{item.scheduled_date}</span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{item.customer_name}</p>
                        <p className="text-[10px] text-slate-500">
                          {item.ac_brand} {item.ac_model}
                        </p>
                      </td>
                      <td className="p-3.5 font-bold text-slate-800">{item.technician_name}</td>
                      <td className="p-3.5 font-semibold text-slate-700">{item.package_name}</td>
                      <td className="p-3.5 text-right font-black text-slate-900">
                        Rs. {Number(item.final_customer_price || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-700">
                        Rs. {Number(item.final_technician_earnings || item.agreed_technician_fee || 0).toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800">
                          {item.workflow_status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {item.workflow_status === 'OFFERED' && (
                            <>
                              <button
                                onClick={() => handleRespondOffer(item.job_id, 'ACCEPT')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer"
                              >
                                Accept Offer
                              </button>
                              <button
                                onClick={() => handleRespondOffer(item.job_id, 'REJECT')}
                                className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {['ASSIGNED', 'ACCEPTED'].includes(item.workflow_status) && (
                            <button
                              onClick={() => handleWorkflowTransition(item.job_id, 'ON_THE_WAY')}
                              className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              On The Way
                            </button>
                          )}
                          {['ASSIGNED', 'ACCEPTED', 'ON_THE_WAY'].includes(item.workflow_status) && (
                            <button
                              onClick={() => handleWorkflowTransition(item.job_id, 'IN_PROGRESS')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Start Work
                            </button>
                          )}
                          {['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(item.workflow_status) && (
                            <button
                              onClick={() => handleWorkflowTransition(item.job_id, 'COMPLETED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-black cursor-pointer"
                            >
                              Complete Job
                            </button>
                          )}
                          <button
                            onClick={() => setShowExtraModal(item)}
                            className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold cursor-pointer"
                          >
                            + Extra Work
                          </button>
                          {!isTech && (
                            <button
                              onClick={() => handleGenerateInvoice(item.job_id)}
                              className="px-2 py-1 rounded-lg bg-slate-900 text-white text-[10px] font-bold cursor-pointer"
                            >
                              Generate Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EARNINGS LEDGER & PAYOUTS */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Interactive Daily / Weekly / Monthly Freelance Technician Payout Center */}
          <div className="bg-gradient-to-br from-slate-900 via-[#1E194D] to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-500/30 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-400 text-slate-950">
                  DAILY · WEEKLY · MONTHLY FREELANCE PAYOUT ENGINE
                </span>
                <h3 className="text-base font-black mt-1">
                  Select Freelance Technician to View & Pay Daily, Weekly, or Monthly Earnings
                </h3>
                <p className="text-xs text-slate-300">
                  Select a freelance technician below to immediately see their unpaid amount for Today (Daily), Last 7 Days (Weekly), This Month (Monthly), or Full Unpaid Balance.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={payoutCenterTechId}
                  onChange={e => setPayoutCenterTechId(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-black border border-slate-300 min-w-[280px]"
                >
                  <option value="">Select Freelance Technician...</option>
                  {freelanceOnlyTechnicians.map(t => (
                    <option key={`center-tech-${t.user_id || t.id}`} value={t.user_id}>
                      {t.full_name} ({t.technician_code}) — Unpaid Payable: Rs.{' '}
                      {Number(t.balance_payable || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
                {!isTech && (
                  <button
                    type="button"
                    onClick={() => openPayoutModalForTechnician(payoutCenterTechId || '')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4" /> Record Freelance Payout
                  </button>
                )}
              </div>
            </div>

            {payoutCenterTechId && payoutCenterPreview?.cycles && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {[
                  { key: 'DAILY', title: 'Daily Payout (Today)', badge: 'DAILY', color: 'from-sky-500/20 to-sky-600/10 border-sky-400/40' },
                  { key: 'WEEKLY', title: 'Weekly Payout (7 Days)', badge: 'WEEKLY', color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-400/40' },
                  { key: 'MONTHLY', title: 'Monthly Payout (This Month)', badge: 'MONTHLY', color: 'from-purple-500/20 to-purple-600/10 border-purple-400/40' },
                  { key: 'ALL', title: 'All Unpaid Balance', badge: 'TOTAL DUE', color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-400/40' }
                ].map(card => {
                  const cyc = payoutCenterPreview.cycles[card.key] || {};
                  const unpaidAmt = Number(cyc.total_unpaid_balance || 0);
                  return (
                    <div
                      key={card.key}
                      className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} border flex flex-col justify-between gap-3`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                            {card.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white/15 text-[9px] font-black uppercase">
                            {cyc.unpaid_jobs_count || 0} Unpaid Jobs
                          </span>
                        </div>
                        <p className="text-xl font-black text-white mt-1.5">
                          Rs. {unpaidAmt.toLocaleString()}
                        </p>
                        <div className="text-[11px] text-slate-300 mt-1 flex items-center justify-between">
                          <span>Earned: Rs. {Number(cyc.total_earnings || 0).toLocaleString()}</span>
                          <span>Paid: Rs. {Number(cyc.already_paid || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {!isTech && (
                        <button
                          type="button"
                          onClick={() => openPayoutModalForTechnician(payoutCenterTechId, card.key)}
                          className={`w-full py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            unpaidAmt > 0
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md'
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          {unpaidAmt > 0
                            ? `Pay ${card.badge} (Rs. ${unpaidAmt.toLocaleString()})`
                            : `View ${card.badge} Payout`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Freelance Technician Payout Requests (Daily / Weekly / Monthly) */}
          {renderPayoutRequestsSection()}

          {/* Technician Commission & Earnings Transaction Ledger with 2 Color-Coded Separate Tabs */}
          {(() => {
            const isFreelanceTab = ledgerTechTypeTab === 'FREELANCE';
            const activeLedgerList = isFreelanceTab ? freelanceLedgerRows : companyLedgerRows;
            const flTotalPayable = freelanceLedgerRows.reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0);
            const flTotalUnpaid = freelanceLedgerRows.reduce((s, r) => s + Number(r.balance_payable || 0), 0);
            const ctTotalPayable = companyLedgerRows.reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0);
            const ctTotalUnpaid = companyLedgerRows.reduce((s, r) => s + Number(r.balance_payable || 0), 0);

            return (
              <div
                className={`bg-white rounded-2xl border-2 shadow-2xs overflow-hidden transition-colors ${
                  isFreelanceTab ? 'border-purple-300' : 'border-teal-300'
                }`}
              >
                <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Technician Commission & Earnings Transaction Ledger
                    </h3>
                    <p className="text-xs text-slate-500">
                      Separated into 2 color-coded tabs: <strong className="text-purple-700">Freelance Technicians (Purple)</strong> &{' '}
                      <strong className="text-teal-700">Company Technicians (Teal)</strong>.
                    </p>
                  </div>
                  {!isTech && (
                    <button
                      onClick={() => openPayoutModalForTechnician(payoutCenterTechId || '')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer self-start lg:self-auto"
                    >
                      <CreditCard className="w-4 h-4" /> Record Freelance Technician Payout
                    </button>
                  )}
                </div>

                {/* 2 Color-Coded Tabs: Tab 1 = Freelance Technicians (Purple), Tab 2 = Company Technicians (Teal) */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLedgerTechTypeTab('FREELANCE')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isFreelanceTab
                        ? 'bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 text-white border-purple-800 shadow-lg ring-2 ring-purple-400/40'
                        : 'bg-purple-50/70 hover:bg-purple-100/80 text-purple-950 border-purple-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            isFreelanceTab ? 'bg-white text-purple-900' : 'bg-purple-600 text-white'
                          }`}
                        >
                          FREELANCE TECHNICIANS
                        </span>
                        <span className={`text-xs font-black ${isFreelanceTab ? 'text-purple-100' : 'text-purple-700'}`}>
                          {freelanceLedgerRows.length} Completed Jobs
                        </span>
                      </div>
                      <p className={`text-xs font-bold mt-1.5 ${isFreelanceTab ? 'text-purple-100' : 'text-slate-600'}`}>
                        Total Accrued: Rs. {flTotalPayable.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black uppercase block ${isFreelanceTab ? 'text-purple-200' : 'text-purple-700'}`}>
                        Unpaid Payable
                      </span>
                      <span className={`text-lg font-black ${isFreelanceTab ? 'text-white' : 'text-purple-800'}`}>
                        Rs. {flTotalUnpaid.toLocaleString()}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLedgerTechTypeTab('COMPANY')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      !isFreelanceTab
                        ? 'bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-700 text-white border-teal-800 shadow-lg ring-2 ring-teal-400/40'
                        : 'bg-teal-50/70 hover:bg-teal-100/80 text-teal-950 border-teal-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            !isFreelanceTab ? 'bg-white text-teal-900' : 'bg-teal-600 text-white'
                          }`}
                        >
                          COMPANY TECHNICIANS
                        </span>
                        <span className={`text-xs font-black ${!isFreelanceTab ? 'text-teal-100' : 'text-teal-700'}`}>
                          {companyLedgerRows.length} Completed Jobs
                        </span>
                      </div>
                      <p className={`text-xs font-bold mt-1.5 ${!isFreelanceTab ? 'text-teal-100' : 'text-slate-600'}`}>
                        Total Accrued: Rs. {ctTotalPayable.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black uppercase block ${!isFreelanceTab ? 'text-teal-200' : 'text-teal-700'}`}>
                        Balance Tracked
                      </span>
                      <span className={`text-lg font-black ${!isFreelanceTab ? 'text-white' : 'text-teal-800'}`}>
                        Rs. {ctTotalUnpaid.toLocaleString()}
                      </span>
                    </div>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className={`text-[10px] font-black uppercase border-b ${
                        isFreelanceTab
                          ? 'bg-purple-50 text-purple-900 border-purple-200'
                          : 'bg-teal-50 text-teal-900 border-teal-200'
                      }`}
                    >
                      <tr>
                        <th className="p-3">Ledger Ref & Job</th>
                        <th className="p-3">
                          {isFreelanceTab ? 'Freelance Technician' : 'Company Technician'}
                        </th>
                        <th className="p-3">Customer & Invoice</th>
                        <th className="p-3 text-right">Customer Price</th>
                        <th className="p-3 text-right">Agreed Fee + Extras</th>
                        {!isTech && <th className="p-3 text-right">Company Comm.</th>}
                        <th className="p-3 text-right">Adjustments</th>
                        <th className="p-3 text-right">Tech Payable</th>
                        <th className="p-3 text-right">Paid / Balance</th>
                        <th className="p-3 text-center">Ledger Status</th>
                        {!isTech && <th className="p-3 text-center">Manage</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeLedgerList.length === 0 ? (
                        <tr>
                          <td colSpan={isTech ? 9 : 11} className="p-8 text-center text-slate-400 font-bold">
                            No {isFreelanceTab ? 'Freelance Technician' : 'Company Technician'} ledger transactions found for the selected filter.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {activeLedgerList.map(l => (
                            <tr
                              key={l.id}
                              className={`transition-colors ${
                                isFreelanceTab ? 'hover:bg-purple-50/40' : 'hover:bg-teal-50/40'
                              }`}
                            >
                              <td className="p-3">
                                <span className="font-mono font-bold text-slate-700 block">{l.ledger_ref}</span>
                                <button
                                  onClick={() => setSelectedJobForDetail({ id: l.job_id, job_number: l.job_number })}
                                  className={`font-mono text-[11px] font-black hover:underline cursor-pointer ${
                                    isFreelanceTab ? 'text-purple-700' : 'text-teal-700'
                                  }`}
                                >
                                  Job #{l.job_number}
                                </button>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900">{l.technician_name}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                      isFreelanceTab
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : 'bg-teal-100 text-teal-800 border border-teal-200'
                                    }`}
                                  >
                                    {isFreelanceTab ? 'Freelance' : 'Company'}
                                  </span>
                                </div>
                                {l.technician_code && (
                                  <span className="font-mono text-[10px] text-slate-400 block">{l.technician_code}</span>
                                )}
                              </td>
                              <td className="p-3">
                                <p className="font-bold text-slate-800">{l.customer_name}</p>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {l.invoice_number
                                    ? `${l.invoice_number} (Paid: Rs. ${Number(l.customer_collected_amount || 0).toLocaleString()})`
                                    : 'Not Invoiced'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold">
                                Rs. {Number(l.customer_price || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-semibold text-emerald-800">
                                Rs.{' '}
                                {Number(
                                  (l.agreed_technician_fee || 0) + (l.technician_extras_entitlement || 0)
                                ).toLocaleString()}
                              </td>
                              {!isTech && (
                                <td className="p-3 text-right font-black text-indigo-700">
                                  Rs. {Number(l.company_commission || 0).toLocaleString()}
                                </td>
                              )}
                              <td className="p-3 text-right font-semibold">
                                Rs. {Number(l.approved_adjustments || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right font-black text-slate-900">
                                Rs. {Number(l.technician_payable_amount || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-right">
                                <span className="font-bold text-emerald-700 block">
                                  Paid: Rs. {Number(l.amount_paid || 0).toLocaleString()}
                                </span>
                                <span className="font-black text-amber-800 text-[11px]">
                                  Due: Rs. {Number(l.balance_payable || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    l.payment_status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : l.payment_status === 'PAYABLE' || l.payment_status === 'APPROVED'
                                      ? 'bg-sky-100 text-sky-800'
                                      : l.payment_status === 'DISPUTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {l.payment_status}
                                </span>
                              </td>
                              {!isTech && (
                                <td className="p-3 text-center">
                                  <div className="flex flex-wrap items-center justify-center gap-1">
                                    {isFreelanceTab && Number(l.balance_payable || 0) > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => openPayoutModalForTechnician(l.technician_id)}
                                        className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black cursor-pointer"
                                      >
                                        Pay
                                      </button>
                                    )}
                                    {l.payment_status === 'PENDING_APPROVAL' && (
                                      <button
                                        onClick={() => handleLedgerStatusChange(l.id, 'PAYABLE')}
                                        className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Approve Payable
                                      </button>
                                    )}
                                    {l.payment_status !== 'PAID' && (
                                      <button
                                        onClick={() => handleLedgerStatusChange(l.id, 'DISPUTED')}
                                        className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold cursor-pointer"
                                      >
                                        Dispute
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setShowAdjustModal(l);
                                        setAdjustForm({
                                          approved_adjustments: l.approved_adjustments || 0,
                                          adjustment_notes: l.adjustment_notes || '',
                                          resolve_dispute: l.payment_status === 'DISPUTED',
                                          dispute_resolution_notes: l.dispute_resolution_notes || ''
                                        });
                                      }}
                                      className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-bold cursor-pointer"
                                    >
                                      Adjust
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                          <tr
                            className={`font-black border-t-2 ${
                              isFreelanceTab
                                ? 'bg-purple-50/90 text-purple-950 border-purple-300'
                                : 'bg-teal-50/90 text-teal-950 border-teal-300'
                            }`}
                          >
                            <td className="p-3" colSpan="3">
                              TOTAL ({isFreelanceTab ? 'FREELANCE TECHNICIANS' : 'COMPANY TECHNICIANS'} — {activeLedgerList.length} Jobs)
                            </td>
                            <td className="p-3 text-right">
                              Rs.{' '}
                              {activeLedgerList
                                .reduce((s, r) => s + Number(r.customer_price || 0), 0)
                                .toLocaleString()}
                            </td>
                            <td className="p-3 text-right text-emerald-800">
                              Rs.{' '}
                              {activeLedgerList
                                .reduce(
                                  (s, r) =>
                                    s + Number((r.agreed_technician_fee || 0) + (r.technician_extras_entitlement || 0)),
                                  0
                                )
                                .toLocaleString()}
                            </td>
                            {!isTech && (
                              <td className="p-3 text-right text-indigo-700">
                                Rs.{' '}
                                {activeLedgerList
                                  .reduce((s, r) => s + Number(r.company_commission || 0), 0)
                                  .toLocaleString()}
                              </td>
                            )}
                            <td className="p-3 text-right">
                              Rs.{' '}
                              {activeLedgerList
                                .reduce((s, r) => s + Number(r.approved_adjustments || 0), 0)
                                .toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              Rs.{' '}
                              {activeLedgerList
                                .reduce((s, r) => s + Number(r.technician_payable_amount || 0), 0)
                                .toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <span className="block text-emerald-700">
                                Paid: Rs.{' '}
                                {activeLedgerList
                                  .reduce((s, r) => s + Number(r.amount_paid || 0), 0)
                                  .toLocaleString()}
                              </span>
                              <span className="block text-amber-800">
                                Due: Rs.{' '}
                                {activeLedgerList
                                  .reduce((s, r) => s + Number(r.balance_payable || 0), 0)
                                  .toLocaleString()}
                              </span>
                            </td>
                            <td className="p-3" colSpan={isTech ? 1 : 2}></td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Payout History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-sm font-black text-slate-900">Technician Payout History & Receipts</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3">Payout #</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Technician</th>
                    <th className="p-3">Method & Reference</th>
                    <th className="p-3 text-right">Amount Paid</th>
                    <th className="p-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-black text-indigo-700">{p.payout_number}</td>
                      <td className="p-3 font-semibold">{p.payment_date}</td>
                      <td className="p-3 font-bold text-slate-900">{p.technician_name}</td>
                      <td className="p-3">
                        <span className="font-bold">{p.payment_method}</span>
                        {p.reference_number && <span className="block text-[10px] font-mono text-slate-500">Ref: {p.reference_number}</span>}
                      </td>
                      <td className="p-3 text-right font-black text-emerald-700">
                        Rs. {Number(p.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedPayoutReceipt(p)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] cursor-pointer"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reportType}
                onChange={e => setReportType(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-black bg-slate-50"
              >
                <option value="freelance_jobs">1. Freelance Job Report</option>
                <option value="technician_earnings">2. Technician Earnings Statement</option>
                {!isTech && <option value="company_commission">3. Company Commission Report</option>}
                <option value="technician_payouts">4. Technician Payout Report</option>
                <option value="unpaid_earnings">5. Unpaid Earnings Report</option>
                {!isTech && <option value="customer_collections">6. Customer Collections Report</option>}
                {!isTech && <option value="estimate_vs_final">7. Estimate vs Final Price Report</option>}
                <option value="adjustments_disputes">8. Adjustments, Refunds & Disputes Report</option>
              </select>

              <input
                type="text"
                placeholder="Search job #, customer, invoice..."
                value={reportSearch}
                onChange={e => setReportSearch(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold w-60"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={exportReportCsv}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export CSV / Excel
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">Ref / Job #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Technician</th>
                  <th className="p-3">Customer / Package</th>
                  <th className="p-3 text-right">Customer Price</th>
                  <th className="p-3 text-right">Tech Payable</th>
                  {!isTech && <th className="p-3 text-right">Company Comm.</th>}
                  <th className="p-3 text-right">Paid / Balance</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData.rows || []).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-indigo-700">
                      {r.job_number || r.payout_number}
                    </td>
                    <td className="p-3">{r.scheduled_date || r.payment_date}</td>
                    <td className="p-3 font-bold">{r.technician_name}</td>
                    <td className="p-3">
                      <span className="font-bold block">{r.customer_name || r.payment_method}</span>
                      <span className="text-[10px] text-slate-500">{r.package_name || r.reference_number}</span>
                    </td>
                    <td className="p-3 text-right font-bold">
                      Rs. {Number(r.final_customer_price || r.total_amount || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-700">
                      Rs. {Number(r.technician_payable_amount || r.agreed_technician_fee || r.total_amount || 0).toLocaleString()}
                    </td>
                    {!isTech && (
                      <td className="p-3 text-right font-black text-indigo-700">
                        Rs. {Number(r.final_company_commission || 0).toLocaleString()}
                      </td>
                    )}
                    <td className="p-3 text-right">
                      Rs. {Number(r.tech_amount_paid || r.total_amount || 0).toLocaleString()} / Due: Rs.{' '}
                      {Number(r.tech_balance_payable || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {r.tech_payment_status || r.workflow_status || r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ONBOARD / EDIT FREELANCE TECHNICIAN */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveTechnician}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
          >
            <div className="p-5 bg-[#423A8E] text-white flex items-center justify-between">
              <h3 className="text-sm font-black">
                {editingTech ? `Edit Freelance Technician (${editingTech.technician_code})` : 'Onboard New Freelance Technician'}
              </h3>
              <button type="button" onClick={() => setShowOnboardModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs max-h-[75vh] overflow-y-auto">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                <input
                  required
                  value={techForm.full_name}
                  onChange={e => setTechForm({ ...techForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone / WhatsApp *</label>
                <input
                  required
                  value={techForm.phone}
                  onChange={e => setTechForm({ ...techForm, phone: e.target.value, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Email</label>
                <input
                  type="email"
                  value={techForm.email}
                  onChange={e => setTechForm({ ...techForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">National ID / NIC Number</label>
                <input
                  value={techForm.id_number}
                  onChange={e => setTechForm({ ...techForm, id_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Name</label>
                <input
                  value={techForm.bank_name}
                  onChange={e => setTechForm({ ...techForm, bank_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Bank Account Number</label>
                <input
                  value={techForm.bank_account_number}
                  onChange={e => setTechForm({ ...techForm, bank_account_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Skills (comma separated)</label>
                <input
                  value={techForm.skills}
                  onChange={e => setTechForm({ ...techForm, skills: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Areas (comma separated)</label>
                <input
                  value={techForm.service_areas}
                  onChange={e => setTechForm({ ...techForm, service_areas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ID Verification Status</label>
                <select
                  value={techForm.id_verification_status}
                  onChange={e => setTechForm({ ...techForm, id_verification_status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={techForm.status}
                  onChange={e => setTechForm({ ...techForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOnboardModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-black">
                Save Freelance Technician
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: CONFIGURE SERVICE PACKAGE RATE CARD */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRateCard}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-5 bg-[#423A8E] text-white flex items-center justify-between">
              <h3 className="text-sm font-black">Configure Service Package Rate & Commission</h3>
              <button type="button" onClick={() => setShowRateModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Service Package *</label>
                <select
                  value={rateForm.package_name}
                  onChange={e => {
                    const pkgName = e.target.value;
                    const nums = resolveLocalPackageNumbers(pkgName, rateForm.technician_id);
                    setRateForm({
                      ...rateForm,
                      package_name: pkgName,
                      technician_fee: nums.technician_fee,
                      commission_value: nums.company_commission,
                      customer_base_price: nums.customer_price
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold mb-1.5"
                >
                  {allPackageOptions.map((opt, idx) => (
                    <option key={idx} value={opt.package_name}>
                      {opt.package_name} (Cust: Rs.{Number(opt.customer_base_price || 0).toLocaleString()} / Tech: Rs.{Number(opt.technician_fee || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Or type custom package name..."
                  required
                  value={rateForm.package_name}
                  onChange={e => setRateForm({ ...rateForm, package_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-xl font-semibold text-[11px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Optional Technician-Specific Negotiated Rate (Freelance or Company Tech)
                </label>
                <select
                  value={rateForm.technician_id}
                  onChange={e => setRateForm({ ...rateForm, technician_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="">Company-Wide Default for Package</option>
                  {technicians.map(t => (
                    <option key={t.user_id || t.id} value={t.user_id}>
                      [{t.technician_type === 'COMPANY' ? 'Company Tech' : 'Freelance'}] {t.full_name} ({t.technician_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Technician Agreed Fee (LKR)</label>
                  <input
                    type="number"
                    required
                    value={rateForm.technician_fee}
                    onChange={e => setRateForm({ ...rateForm, technician_fee: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-black text-emerald-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Commission Type</label>
                  <select
                    value={rateForm.commission_type}
                    onChange={e => setRateForm({ ...rateForm, commission_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="FIXED">FIXED AMOUNT (LKR)</option>
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {rateForm.commission_type === 'PERCENTAGE' ? 'Commission Percentage (%)' : 'Company Commission (LKR)'}
                  </label>
                  <input
                    type="number"
                    required
                    value={rateForm.commission_value}
                    onChange={e => setRateForm({ ...rateForm, commission_value: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-black text-indigo-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={rateForm.effective_date}
                    onChange={e => setRateForm({ ...rateForm, effective_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Live Formula Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1">
                <span className="text-[10px] font-black uppercase text-indigo-900">Backend Formula Verification</span>
                <p className="text-sm font-black text-slate-900">
                  Customer Price: Rs. {computedRatePreview.customer_price.toLocaleString()} = Tech Fee Rs.{' '}
                  {computedRatePreview.technician_fee.toLocaleString()} + Company Commission Rs.{' '}
                  {computedRatePreview.company_commission.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-black">
                Save Rate Card
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: ASSIGN JOB TO FREELANCE OR COMPANY TECHNICIAN WITH PRE-ASSIGNMENT BREAKDOWN */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleConfirmAssignment}
            className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
          >
            <div className="p-5 bg-[#423A8E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">
                  Assign / Offer Service Job (Freelance & Company Technicians)
                </h3>
                <p className="text-[11px] text-indigo-200">
                  Select a job, choose any Freelance or Company Technician, and verify the package commission split.
                </p>
              </div>
              <button type="button" onClick={() => setShowAssignModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-xs">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-700">Select Service Job *</label>
                  <div className="flex flex-wrap items-center gap-1">
                    {[
                      { id: 'ALL', label: `All Jobs (${assignJobCounts.all})` },
                      { id: 'TODAY', label: `Today (${assignJobCounts.today})` },
                      { id: 'TOMORROW', label: `Tomorrow (${assignJobCounts.tomorrow})` },
                      { id: 'UNASSIGNED', label: `Unassigned (${assignJobCounts.unassigned})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setAssignJobDateFilter(tab.id);
                          const nextMatching = allJobs.filter(j => {
                            const b = classifyJobScheduleBucket(j);
                            if (tab.id === 'TODAY') return b === 'TODAY';
                            if (tab.id === 'TOMORROW') return b === 'TOMORROW';
                            if (tab.id === 'UNASSIGNED') return !j.technician_id;
                            return true;
                          });
                          if (nextMatching.length > 0 && !nextMatching.some(j => String(j.id) === String(assignForm.job_id))) {
                            selectJobInAssignModal(nextMatching[0]);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                          assignJobDateFilter === tab.id
                            ? tab.id === 'TODAY'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : tab.id === 'TOMORROW'
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'bg-[#423A8E] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Service Job Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={assignJobSearch}
                    onChange={e => setAssignJobSearch(e.target.value)}
                    placeholder="Search job #, customer name, phone, AC brand/model, package, or date..."
                    className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white font-semibold text-slate-800 placeholder:text-slate-400"
                  />
                  {assignJobSearch && (
                    <button
                      type="button"
                      onClick={() => setAssignJobSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Select */}
                <select
                  required
                  value={assignForm.job_id}
                  onChange={e => {
                    const selectedJobId = e.target.value;
                    const jobObj = allJobs.find(j => String(j.id) === String(selectedJobId));
                    if (jobObj) {
                      selectJobInAssignModal(jobObj);
                    } else {
                      setAssignForm({ ...assignForm, job_id: selectedJobId });
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                >
                  <option value="">
                    Choose a service job ({filteredAssignJobs.length} matching)...
                  </option>
                  {(filteredAssignJobs.length > 0 ? filteredAssignJobs : allJobs).map(j => {
                    const bucket = classifyJobScheduleBucket(j);
                    const prefix = bucket === 'TODAY' ? '[TODAY] ' : bucket === 'TOMORROW' ? '[TOMORROW] ' : '';
                    return (
                      <option key={j.id} value={j.id}>
                        {prefix}#{j.job_number} — {j.customer_name} ({j.ac_brand} {j.ac_model}) [{j.scheduled_date}{j.scheduled_time ? ` ${j.scheduled_time}` : ''}] • {j.package_name || j.service_type || 'Full Service'}
                      </option>
                    );
                  })}
                </select>

                {/* Interactive Today / Tomorrow / Searchable Job List */}
                <div className="border border-slate-200 rounded-2xl bg-slate-50/70 max-h-44 overflow-y-auto divide-y divide-slate-200/80">
                  {filteredAssignJobs.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 font-semibold text-[11px]">
                      No jobs match "{assignJobSearch || assignJobDateFilter}".{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAssignJobDateFilter('ALL');
                          setAssignJobSearch('');
                        }}
                        className="text-indigo-600 underline font-bold cursor-pointer"
                      >
                        Show all jobs
                      </button>
                    </div>
                  ) : (
                    filteredAssignJobs.map(j => {
                      const isSelected = String(assignForm.job_id) === String(j.id);
                      const bucket = classifyJobScheduleBucket(j);
                      return (
                        <div
                          key={j.id}
                          onClick={() => selectJobInAssignModal(j)}
                          className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/90 border-l-4 border-indigo-600' : 'hover:bg-white'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {bucket === 'TODAY' && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase">
                                  Today
                                </span>
                              )}
                              {bucket === 'TOMORROW' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black uppercase">
                                  Tomorrow
                                </span>
                              )}
                              <span className="font-mono font-black text-indigo-800 text-[11px]">
                                #{j.job_number}
                              </span>
                              <span className="font-black text-slate-900 truncate">
                                {j.customer_name}
                              </span>
                              {j.customer_phone && (
                                <span className="text-[10px] text-slate-500 font-semibold">
                                  ({j.customer_phone})
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-600 font-medium truncate mt-0.5">
                              {j.ac_brand} {j.ac_model} • <span className="font-bold text-indigo-700">{j.package_name || j.service_type || 'Full Service'}</span> • 📅 {j.scheduled_date} {j.scheduled_time || ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {j.technician_name ? (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold">
                                {j.technician_name}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold">
                                Unassigned
                              </span>
                            )}
                            <span
                              className={`px-2 py-1 rounded-lg text-[10px] font-black ${
                                isSelected
                                  ? 'bg-[#423A8E] text-white'
                                  : 'bg-white border border-slate-300 text-slate-700'
                              }`}
                            >
                              {isSelected ? 'Selected ✓' : 'Select'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      Technician (Freelance & Company) *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAssignModal(false);
                        setEditingTech(null);
                        setShowOnboardModal(true);
                      }}
                      className="text-[10px] font-black text-indigo-700 hover:underline cursor-pointer"
                    >
                      + Add Tech
                    </button>
                  </div>
                  <select
                    required
                    value={assignForm.technician_id}
                    onChange={e => {
                      const techId = e.target.value;
                      const nums = resolveLocalPackageNumbers(assignForm.package_name, techId);
                      const next = {
                        ...assignForm,
                        technician_id: techId,
                        custom_technician_fee: nums.technician_fee,
                        custom_company_commission: nums.company_commission
                      };
                      setAssignForm(next);
                      handlePreviewAssignment(next);
                    }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    <option value="">Select Freelancer or Company Tech...</option>
                    {technicians
                      .filter(t => t.status !== 'SUSPENDED' && t.status !== 'INACTIVE')
                      .map(t => (
                        <option key={t.user_id || t.id} value={t.user_id}>
                          [{t.technician_type === 'COMPANY' ? 'Company Tech' : 'Freelance'}] {t.full_name} ({t.technician_code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Service Package *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAssignModal(false);
                        setShowRateModal(true);
                      }}
                      className="text-[10px] font-black text-indigo-700 hover:underline cursor-pointer"
                    >
                      + Rate Card
                    </button>
                  </div>
                  <select
                    value={assignForm.package_name}
                    onChange={e => {
                      const pkgName = e.target.value;
                      const nums = resolveLocalPackageNumbers(pkgName, assignForm.technician_id);
                      const next = {
                        ...assignForm,
                        package_name: pkgName,
                        custom_technician_fee: nums.technician_fee,
                        custom_company_commission: nums.company_commission
                      };
                      setAssignForm(next);
                      handlePreviewAssignment(next);
                    }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    {allPackageOptions.map((opt, idx) => (
                      <option key={idx} value={opt.package_name}>
                        {opt.package_name} (Cust: Rs.{Number(opt.customer_base_price || 0).toLocaleString()} / Tech: Rs.{Number(opt.technician_fee || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Editable Fee & Commission Split Controls */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="font-bold text-emerald-700 block mb-1 text-[11px]">
                    Technician Fee (Rs.)
                  </label>
                  <input
                    type="number"
                    value={assignForm.custom_technician_fee}
                    onChange={e => {
                      const next = { ...assignForm, custom_technician_fee: e.target.value };
                      setAssignForm(next);
                      handlePreviewAssignment(next);
                    }}
                    className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/40 rounded-xl font-black text-emerald-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-indigo-700 block mb-1 text-[11px]">
                    Company Comm. (Rs.)
                  </label>
                  <input
                    type="number"
                    value={assignForm.custom_company_commission}
                    onChange={e => {
                      const next = { ...assignForm, custom_company_commission: e.target.value };
                      setAssignForm(next);
                      handlePreviewAssignment(next);
                    }}
                    className="w-full px-3 py-2 border border-indigo-300 bg-indigo-50/40 rounded-xl font-black text-indigo-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1 text-[11px]">
                    Discount (Rs.)
                  </label>
                  <input
                    type="number"
                    value={assignForm.customer_discounts}
                    onChange={e => {
                      const next = { ...assignForm, customer_discounts: Number(e.target.value || 0) };
                      setAssignForm(next);
                      handlePreviewAssignment(next);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Offer vs Direct Dispatch Mode */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(assignForm.require_offer_acceptance)}
                    onChange={e => setAssignForm({ ...assignForm, require_offer_acceptance: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  Allow Technician to Accept / Reject Offer (Uncheck for Direct Assignment)
                </label>
              </div>

              {assignPreview && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-indigo-800 block">
                    Pre-Assignment Financial Breakdown
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold block">Customer Price</span>
                      <span className="text-sm font-black text-slate-900">
                        Rs. {Number(assignPreview.breakdown.customer_price || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 font-bold block">Technician Fee</span>
                      <span className="text-sm font-black text-emerald-900">
                        Rs. {Number(assignPreview.breakdown.technician_fee || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200">
                      <span className="text-[10px] text-indigo-700 font-bold block">Company Comm.</span>
                      <span className="text-sm font-black text-indigo-900">
                        Rs. {Number(assignPreview.breakdown.company_commission || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#00CCCD] text-slate-950 text-xs font-black cursor-pointer">
                Confirm & Dispatch Job
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: ADD / APPROVE EXTRA WORK & PARTS */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddExtraWork}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-5 bg-[#423A8E] text-white flex items-center justify-between">
              <h3 className="text-sm font-black">Add Extra Service / Part (#{showExtraModal.job_number})</h3>
              <button type="button" onClick={() => setShowExtraModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Extra Item / Service Description *</label>
                <input
                  required
                  placeholder="e.g., Capacitor Replacement / Extra R32 Gas Top-up"
                  value={extraForm.name}
                  onChange={e => setExtraForm({ ...extraForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Customer Charge</label>
                  <input
                    type="number"
                    required
                    value={extraForm.customer_charge}
                    onChange={e => setExtraForm({ ...extraForm, customer_charge: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-emerald-700 block mb-1">Tech Entitlement</label>
                  <input
                    type="number"
                    required
                    value={extraForm.technician_entitlement}
                    onChange={e => setExtraForm({ ...extraForm, technician_entitlement: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Part Cost</label>
                  <input
                    type="number"
                    value={extraForm.cost}
                    onChange={e => setExtraForm({ ...extraForm, cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExtraModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-black">
                Save Extra Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: RECORD FREELANCE TECHNICIAN PAYOUT (DAILY / WEEKLY / MONTHLY / FULL) */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleRecordPayout}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
          >
            <div className="p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/20">
                  DAILY · WEEKLY · MONTHLY SETTLEMENT
                </span>
                <h3 className="text-base font-black mt-0.5">
                  Record Freelance Technician Payout
                </h3>
              </div>
              <button type="button" onClick={() => setShowPayoutModal(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs max-h-[78vh] overflow-y-auto">
              {/* Step 1: Select Freelance Technician Only */}
              <div>
                <label className="font-black text-slate-800 block mb-1">
                  1. Select Freelance Technician *
                </label>
                <select
                  required
                  value={payoutForm.technician_id}
                  onChange={e => {
                    const tid = e.target.value;
                    setPayoutForm(prev => ({ ...prev, technician_id: tid }));
                    loadPayoutPreviewForTech(tid, payoutForm.payout_cycle, false);
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-slate-900 bg-slate-50"
                >
                  <option value="">Choose Freelance Technician...</option>
                  {freelanceOnlyTechnicians.map(t => (
                    <option key={`tech-payout-${t.user_id || t.id}`} value={t.user_id}>
                      {t.full_name} ({t.technician_code}) — Unpaid Payable: Rs.{' '}
                      {Number(t.balance_payable || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Freelance Technician Profile & Bank Summary */}
              {payoutForm.technician_id && (() => {
                const selTech = freelanceOnlyTechnicians.find(t => String(t.user_id) === String(payoutForm.technician_id));
                if (!selTech) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{selTech.full_name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-600 text-white">
                          Freelance Technician
                        </span>
                        <span className="font-mono text-[11px] font-bold text-purple-800">{selTech.technician_code}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Phone: <strong className="text-slate-800">{selTech.phone || 'N/A'}</strong> · Bank:{' '}
                        <strong className="text-slate-800">{selTech.bank_name || 'Cash / Direct'}</strong>{' '}
                        {selTech.bank_account_number ? `(${selTech.bank_account_number})` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-purple-700 block">Total Unpaid Balance</span>
                      <span className="text-base font-black text-emerald-700">
                        Rs. {Number(payoutPreview?.cycles?.ALL?.total_unpaid_balance ?? selTech.balance_payable ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Step 2: Select Payout Period (Daily / Weekly / Monthly / All Unpaid) */}
              {payoutForm.technician_id && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-black text-slate-800">
                      2. Choose Payout Frequency (Daily / Weekly / Monthly / Full Balance)
                    </label>
                    {payoutPreviewLoading && (
                      <span className="text-[11px] font-bold text-indigo-600 animate-pulse">
                        Calculating technician earnings...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { key: 'DAILY', label: 'Daily Payout', sub: 'Today' },
                      { key: 'WEEKLY', label: 'Weekly Payout', sub: 'Last 7 Days' },
                      { key: 'MONTHLY', label: 'Monthly Payout', sub: 'This Month' },
                      { key: 'ALL', label: 'All Unpaid', sub: 'Full Balance' }
                    ].map(c => {
                      const cycData = payoutPreview?.cycles?.[c.key] || {};
                      const amt = Number(cycData.total_unpaid_balance || 0);
                      const jobsCnt = Number(cycData.unpaid_jobs_count || 0);
                      const isSelected = payoutForm.payout_cycle === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => selectPayoutCycle(c.key)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30'
                              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-[11px] uppercase">{c.label}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {jobsCnt} {jobsCnt === 1 ? 'Job' : 'Jobs'}
                            </span>
                          </div>
                          <p className={`text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>{c.sub}</p>
                          <p className={`text-sm font-black mt-1 ${isSelected ? 'text-white' : 'text-emerald-700'}`}>
                            Rs. {amt.toLocaleString()}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Unpaid Jobs Table for Selected Period */}
              {payoutForm.technician_id && payoutPreview?.cycles && (() => {
                const activeCycle = payoutPreview.cycles[payoutForm.payout_cycle] || payoutPreview.cycles.ALL || {};
                const unpaidItems = activeCycle.unpaid_items || [];
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        Unpaid Completed Jobs in {activeCycle.label || payoutForm.payout_cycle} ({unpaidItems.length})
                      </span>
                      {unpaidItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => selectPayoutCycle(payoutForm.payout_cycle)}
                          className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                        >
                          Select All ({unpaidItems.length}) — Rs. {Number(activeCycle.total_unpaid_balance || 0).toLocaleString()}
                        </button>
                      )}
                    </div>

                    {unpaidItems.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between gap-2">
                        <span>
                          No unpaid completed jobs found in <strong>{activeCycle.label || payoutForm.payout_cycle}</strong>.
                          {Number(payoutPreview.cycles.ALL?.total_unpaid_balance || 0) > 0 &&
                            ` However, this technician has Rs. ${Number(payoutPreview.cycles.ALL.total_unpaid_balance).toLocaleString()} unpaid in All Unpaid Balance.`}
                        </span>
                        {Number(payoutPreview.cycles.ALL?.total_unpaid_balance || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => selectPayoutCycle('ALL')}
                            className="px-2.5 py-1 rounded-lg bg-amber-800 text-white font-black text-[10px] shrink-0 cursor-pointer"
                          >
                            Switch to All Unpaid (Rs. {Number(payoutPreview.cycles.ALL.total_unpaid_balance).toLocaleString()})
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 sticky top-0">
                            <tr>
                              <th className="p-2 w-8 text-center">Pay</th>
                              <th className="p-2">Job # & Date</th>
                              <th className="p-2">Customer & Package</th>
                              <th className="p-2 text-center">Status</th>
                              <th className="p-2 text-right">Unpaid Payable</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {unpaidItems.map(item => {
                              const checked = (payoutForm.ledger_ids || []).includes(item.id);
                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => togglePayoutLedgerItem(item)}
                                  className={`cursor-pointer transition-colors ${
                                    checked ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-slate-50 opacity-60'
                                  }`}
                                >
                                  <td className="p-2 text-center" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePayoutLedgerItem(item)}
                                      className="rounded border-slate-300 text-emerald-600"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <span className="font-mono font-black text-indigo-700 block">{item.job_number}</span>
                                    <span className="text-[10px] text-slate-500">
                                      {String(item.completed_at || item.scheduled_date || '').slice(0, 10)}
                                    </span>
                                  </td>
                                  <td className="p-2">
                                    <span className="font-bold text-slate-800 block">{item.customer_name}</span>
                                    <span className="text-[10px] text-slate-500">{item.package_name}</span>
                                  </td>
                                  <td className="p-2 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                        item.payment_status === 'PAYABLE' || item.payment_status === 'APPROVED'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-amber-100 text-amber-800'
                                      }`}
                                    >
                                      {item.payment_status}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-black text-emerald-700">
                                    Rs. {Number(item.balance_payable || 0).toLocaleString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Active Assigned Jobs Not Yet Marked Completed */}
              {payoutForm.technician_id && (payoutPreview?.active_in_progress_jobs || []).length > 0 && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-sky-900">
                      Active Assigned Jobs Not Yet Marked Completed ({payoutPreview.active_in_progress_jobs.length}) — Expected Fee: Rs.{' '}
                      {Number(payoutPreview.active_expected_earnings || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {payoutPreview.active_in_progress_jobs.slice(0, 4).map(aj => (
                      <div key={aj.id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-sky-100 text-[11px]">
                        <div>
                          <strong className="font-mono text-indigo-700">{aj.job_number}</strong> · {aj.customer_name} ({aj.package_name}) —{' '}
                          <strong className="text-emerald-700">Rs. {Number(aj.final_technician_earnings || 0).toLocaleString()}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleWorkflowTransition(aj.job_id, 'COMPLETED');
                            await loadPayoutPreviewForTech(payoutForm.technician_id, payoutForm.payout_cycle, false);
                          }}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer"
                        >
                          Complete & Add to Payout
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Payout Amount, Payment Method, Date & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="font-black text-slate-800 block mb-1">
                    3. Payout Amount (LKR) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Auto calculated"
                    value={payoutForm.amount}
                    onChange={e => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-emerald-500 rounded-xl font-black text-sm text-emerald-700 bg-emerald-50/40"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={payoutForm.payment_method}
                    onChange={e => setPayoutForm({ ...payoutForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  >
                    <option value="BANK_TRANSFER">BANK TRANSFER</option>
                    <option value="CASH">CASH</option>
                    <option value="CARD">CARD</option>
                    <option value="ONLINE">ONLINE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payout Date</label>
                  <input
                    type="date"
                    value={payoutForm.payment_date}
                    onChange={e => setPayoutForm({ ...payoutForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reference Number / Bank Slip ID</label>
                  <input
                    placeholder="e.g., COMBANK-SLIP-99281"
                    value={payoutForm.reference_number}
                    onChange={e => setPayoutForm({ ...payoutForm, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Payout Notes</label>
                  <input
                    placeholder="e.g., Weekly settlement / Cash handover"
                    value={payoutForm.notes}
                    onChange={e => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={payoutForm.auto_approve_pending !== false}
                  onChange={e => setPayoutForm({ ...payoutForm, auto_approve_pending: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600"
                />
                <span>Automatically approve completed jobs in Pending Approval status during this payout</span>
              </label>

              <p className="text-[10px] text-slate-500 italic">
                Note: This records an official payout receipt ({payoutForm.payout_cycle} cycle) against the technician's ledger items. It does not execute an automated bank wire transfer.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-700">
                Selected Cycle: <span className="font-black text-emerald-700">{payoutForm.payout_cycle}</span> · Payout Total:{' '}
                <span className="font-black text-emerald-700 text-sm">
                  Rs. {Number(payoutForm.amount || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md cursor-pointer"
                >
                  Record {payoutForm.payout_cycle} Payout & Generate Receipt
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 6: ADJUSTMENT / DISPUTE RESOLUTION */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAdjustment}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="p-5 bg-[#423A8E] text-white flex items-center justify-between">
              <h3 className="text-sm font-black">Authorized Ledger Adjustment ({showAdjustModal.ledger_ref})</h3>
              <button type="button" onClick={() => setShowAdjustModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Approved Adjustment Amount (LKR, use negative for deduction)
                </label>
                <input
                  type="number"
                  required
                  value={adjustForm.approved_adjustments}
                  onChange={e => setAdjustForm({ ...adjustForm, approved_adjustments: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-black"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Authorization / Audit Reason *</label>
                <textarea
                  required
                  rows="3"
                  value={adjustForm.adjustment_notes}
                  onChange={e => setAdjustForm({ ...adjustForm, adjustment_notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              {showAdjustModal.payment_status === 'DISPUTED' && (
                <label className="flex items-center gap-2 font-bold text-emerald-700">
                  <input
                    type="checkbox"
                    checked={adjustForm.resolve_dispute}
                    onChange={e => setAdjustForm({ ...adjustForm, resolve_dispute: e.target.checked })}
                  />
                  <span>Mark Dispute as Resolved & Return to Payable</span>
                </label>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdjustModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#423A8E] text-white text-xs font-black">
                Save Audited Adjustment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 7: PAYOUT RECEIPT VIEWER */}
      {selectedPayoutReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                  Official Technician Payout Receipt
                </span>
                <h3 className="text-base font-black">{selectedPayoutReceipt.payout_number}</h3>
              </div>
              <button onClick={() => setSelectedPayoutReceipt(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-slate-400 font-bold block">Technician</span>
                  <span className="font-black text-slate-900 text-sm">{selectedPayoutReceipt.technician_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-bold block">Payment Date & Method</span>
                  <span className="font-bold text-slate-800">
                    {selectedPayoutReceipt.payment_date} • {selectedPayoutReceipt.payment_method}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-slate-500">Allocated Job Ledger Items</span>
                {(selectedPayoutReceipt.items || []).map(it => (
                  <div key={it.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex justify-between">
                    <div>
                      <span className="font-mono font-bold text-indigo-700">Job #{it.job_number}</span>
                      <span className="block text-[10px] text-slate-500">
                        {it.customer_name} • {it.package_name}
                      </span>
                    </div>
                    <span className="font-black text-slate-900">
                      Rs. {Number(it.amount_allocated || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex justify-between items-center">
                <span className="font-black text-emerald-950">Total Payout Settled</span>
                <span className="text-lg font-black text-emerald-700">
                  Rs. {Number(selectedPayoutReceipt.total_amount || 0).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                onClick={() => setSelectedPayoutReceipt(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Job Details Modal */}
      <JobFullDetailModal
        isOpen={Boolean(selectedJobForDetail)}
        onClose={() => setSelectedJobForDetail(null)}
        job={selectedJobForDetail}
      />
    </div>
  );
}
