import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';
import PwaInstallPrompt from './components/PwaInstallPrompt';

// Pages
import Login from './pages/Login';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import CompaniesList from './pages/super-admin/CompaniesList';
import CompanyDetail from './pages/super-admin/CompanyDetail';
import BillingDashboard from './pages/super-admin/BillingDashboard';
import SmsGatewaySettings from './pages/super-admin/SmsGatewaySettings';
import WhatsAppGatewaySettings from './pages/super-admin/WhatsAppGatewaySettings';
import SaasPricingSettings from './pages/super-admin/SaasPricingSettings';
import AuditLogs from './pages/super-admin/AuditLogs';
import AllTechnicians from './pages/super-admin/AllTechnicians';
import AllInvoices from './pages/super-admin/AllInvoices';
import GlobalPackages from './pages/super-admin/GlobalPackages';

import CompanyDashboard from './pages/company-admin/CompanyDashboard';
import TechniciansList from './pages/company-admin/TechniciansList';
import CustomersList from './pages/company-admin/CustomersList';
import CustomerDetail from './pages/company-admin/CustomerDetail';
import AcUnitsList from './pages/company-admin/AcUnitsList';
import ServiceJobsList from './pages/company-admin/ServiceJobsList';
import ServiceJobDetail from './pages/company-admin/ServiceJobDetail';
import ServiceRemindersList from './pages/company-admin/ServiceRemindersList';
import CompanyServicePackages from './pages/company-admin/CompanyServicePackages';
import InvoicesList from './pages/company-admin/InvoicesList';
import CommunicationLogs from './pages/company-admin/CommunicationLogs';
import CompanyBilling from './pages/company-admin/CompanyBilling';
import CompanyProfile from './pages/company-admin/CompanyProfile';
import CompanyCalendar from './pages/company-admin/CompanyCalendar';
import QuotationsList from './pages/company-admin/QuotationsList';
import CompanyReports from './pages/company-admin/CompanyReports';
import CompanyAdminLogin from './pages/company-admin/CompanyAdminLogin';
import FreelanceCommissionHub from './pages/company-admin/FreelanceCommissionHub';
import LiveDispatchMonitor from './pages/company-admin/LiveDispatchMonitor';

import TechnicianPwaDashboard from './pages/technician-pwa/TechnicianPwaDashboard';
import TechnicianQrScanner from './pages/technician-pwa/TechnicianQrScanner';
import TechnicianLogin from './pages/technician-pwa/TechnicianLogin';
import PublicAcUnitView from './pages/public/PublicAcUnitView';
import PublicQuotationApproval from './pages/public/PublicQuotationApproval';

function ProtectedLayout({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading AC-Pro SaaS...</div>;
  }

  if (!user) {
    const isTechRoute = window.location.pathname.startsWith('/technician');
    return <Navigate to={isTechRoute ? '/technician/login' : '/login'} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      <Navbar onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)} />
      <div className="flex-1 flex w-full relative min-w-0">
        <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto w-full min-w-0">
          {children}
        </main>
      </div>
      <MobileBottomNav onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
}

function RootIndexRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-xs text-slate-400">Loading AC-Pro SaaS...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'TECHNICIAN' || user.role === 'FREELANCE_TECHNICIAN') {
    return <Navigate to="/technician/pwa" replace />;
  }
  if (user.role === 'SUPER_ADMIN') {
    return <Navigate to="/super-admin/dashboard" replace />;
  }
  return <Navigate to="/company/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Smart Root Index */}
          <Route path="/" element={<RootIndexRoute />} />
          {/* Public & Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/company/login" element={<CompanyAdminLogin />} />
          <Route path="/admin/login" element={<CompanyAdminLogin />} />
          <Route path="/technician/login" element={<TechnicianLogin />} />
          <Route path="/tech/login" element={<TechnicianLogin />} />
          <Route path="/verify/:qrCodeId" element={<PublicAcUnitView />} />
          <Route path="/quotation/:quotationNumber/approve" element={<PublicQuotationApproval />} />

          {/* SUPER ADMIN ROUTES */}
          <Route
            path="/super-admin/dashboard"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/companies"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <CompaniesList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/companies/:id"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <CompanyDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/billing"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <BillingDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/pricing"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <SaasPricingSettings />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/sms-gateway"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <SmsGatewaySettings />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/whatsapp-gateway"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <WhatsAppGatewaySettings />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/audit-logs"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <AuditLogs />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/technicians"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <AllTechnicians />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/invoices"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <AllInvoices />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/quotations"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <QuotationsList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/reports"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <CompanyReports />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/service-packages"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <GlobalPackages />
              </ProtectedLayout>
            }
          />

          {/* COMPANY ADMIN ROUTES */}
          <Route
            path="/company/dashboard"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER', 'SERVICE_MANAGER', 'ACCOUNTANT']}>
                <CompanyDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/live-monitor"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER', 'SERVICE_MANAGER', 'ACCOUNTANT']}>
                <LiveDispatchMonitor />
              </ProtectedLayout>
            }
          />
          <Route
            path="/super-admin/freelance"
            element={
              <ProtectedLayout allowedRoles={['SUPER_ADMIN']}>
                <FreelanceCommissionHub />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/freelance"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER', 'SERVICE_MANAGER', 'ACCOUNTANT', 'TECHNICIAN', 'FREELANCE_TECHNICIAN']}>
                <FreelanceCommissionHub />
              </ProtectedLayout>
            }
          />
          <Route
            path="/technician/freelance"
            element={
              <ProtectedLayout allowedRoles={['TECHNICIAN', 'FREELANCE_TECHNICIAN', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <FreelanceCommissionHub />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/reports"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'TECHNICIAN']}>
                <CompanyReports />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/quotations"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'COMPANY_OWNER', 'SERVICE_MANAGER', 'ACCOUNTANT']}>
                <QuotationsList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/technicians"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <TechniciansList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/customers"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CustomersList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/customers/:id"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CustomerDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/ac-units"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <AcUnitsList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/jobs"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <ServiceJobsList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/calendar"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'TECHNICIAN']}>
                <CompanyCalendar />
              </ProtectedLayout>
            }
          />
          <Route path="/admin/calendar" element={<Navigate to="/company/calendar" replace />} />
          <Route path="/calendar" element={<Navigate to="/company/calendar" replace />} />
          <Route
            path="/company/jobs/:id"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'TECHNICIAN']}>
                <ServiceJobDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/service-jobs/:id"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'TECHNICIAN']}>
                <ServiceJobDetail />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/reminders"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <ServiceRemindersList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/service-packages"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CompanyServicePackages />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/invoices"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <InvoicesList />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/communications"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CommunicationLogs />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/billing"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CompanyBilling />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/profile"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CompanyProfile />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/sms-gateway"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CompanyProfile />
              </ProtectedLayout>
            }
          />
          <Route
            path="/company/whatsapp-gateway"
            element={
              <ProtectedLayout allowedRoles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CompanyProfile />
              </ProtectedLayout>
            }
          />

          {/* TECHNICIAN PWA ROUTES */}
          <Route
            path="/technician/pwa"
            element={
              <ProtectedLayout allowedRoles={['TECHNICIAN', 'FREELANCE_TECHNICIAN', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <TechnicianPwaDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/technician/quotations"
            element={<Navigate to="/technician/pwa" replace />}
          />
          <Route
            path="/technician/reports"
            element={
              <ProtectedLayout allowedRoles={['TECHNICIAN', 'FREELANCE_TECHNICIAN', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <CompanyReports />
              </ProtectedLayout>
            }
          />
          <Route
            path="/technician/qr-scanner"
            element={
              <ProtectedLayout allowedRoles={['TECHNICIAN', 'FREELANCE_TECHNICIAN', 'COMPANY_ADMIN', 'SUPER_ADMIN']}>
                <TechnicianQrScanner />
              </ProtectedLayout>
            }
          />

          {/* Root Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <PwaInstallPrompt />
      </BrowserRouter>
    </AuthProvider>
  );
}
