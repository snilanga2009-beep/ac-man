// Professional A4 PDF Report Generator for Earnings & Technician Job Reports (Daily / Weekly / Monthly)

let html2pdfPromise = null;

function loadHtml2PdfLibrary() {
  if (typeof window !== 'undefined' && window.html2pdf) {
    return Promise.resolve(window.html2pdf);
  }
  if (html2pdfPromise) return html2pdfPromise;

  html2pdfPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => resolve(window.html2pdf);
    script.onerror = err => reject(err);
    document.head.appendChild(script);
  });

  return html2pdfPromise;
}

function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatLkr(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString()}`;
}

/**
 * Generates and downloads an A4 PDF report for:
 * - Full Earnings & Technician Report ('all' | 'daily' | 'weekly' | 'monthly')
 * - Specific Technician Report (when a technician object or filter is passed)
 * - Technician App Mode Report
 */
export async function downloadEarningsReportPdf({
  reportType = 'ALL', // 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'TECHNICIAN'
  company = {},
  dates = {},
  daily = {},
  weekly = {},
  monthly = {},
  selectedSummary = {},
  technician = null, // Specific technician object if filtered
  technicianPerformance = [],
  jobsLedger = []
}) {
  const companyName = company?.name || 'AC-Pro Air Conditioning Services';
  const companyPhone = company?.phone || '';
  const companyEmail = company?.email || '';
  const companyAddress = company?.address || '';
  const companyLogo = company?.logo_url || '';
  const todayDate = dates?.today || new Date().toISOString().slice(0, 10);
  const weekStart = dates?.week_start || '';
  const monthPrefix = todayDate.slice(0, 7);

  // Determine report title & filename
  let reportTitle = 'Earnings & Technician Job Report (Daily / Weekly / Monthly)';
  let fileSlug = `AC_Earnings_Report_${todayDate}`;

  if (technician && technician.name) {
    const cleanName = String(technician.name).replace(/[^a-zA-Z0-9]/g, '_');
    if (reportType === 'DAILY') {
      reportTitle = `Daily Technician Earnings & Jobs Report — ${technician.name}`;
      fileSlug = `Tech_Daily_Report_${cleanName}_${todayDate}`;
    } else if (reportType === 'WEEKLY') {
      reportTitle = `Weekly Technician Earnings & Jobs Report — ${technician.name}`;
      fileSlug = `Tech_Weekly_Report_${cleanName}_${todayDate}`;
    } else if (reportType === 'MONTHLY') {
      reportTitle = `Monthly Technician Earnings & Jobs Report — ${technician.name}`;
      fileSlug = `Tech_Monthly_Report_${cleanName}_${monthPrefix}`;
    } else {
      reportTitle = `Technician Earnings & Job Report (Daily / Weekly / Monthly) — ${technician.name}`;
      fileSlug = `Technician_Report_${cleanName}_${todayDate}`;
    }
  } else {
    if (reportType === 'DAILY') {
      reportTitle = `Daily Earnings & Technician Job Report (${todayDate})`;
      fileSlug = `Daily_Earnings_Report_${todayDate}`;
    } else if (reportType === 'WEEKLY') {
      reportTitle = `Weekly Earnings & Technician Job Report (${weekStart} to ${todayDate})`;
      fileSlug = `Weekly_Earnings_Report_${todayDate}`;
    } else if (reportType === 'MONTHLY') {
      reportTitle = `Monthly Earnings & Technician Job Report (${monthPrefix})`;
      fileSlug = `Monthly_Earnings_Report_${monthPrefix}`;
    }
  }

  // Resolve Daily / Weekly / Monthly metrics (use technician's own metrics if a specific tech row was passed)
  const dEarn = technician?.earnings_today !== undefined ? technician.earnings_today : (daily?.earnings || 0);
  const dJobs = technician?.jobs_done_today !== undefined ? technician.jobs_done_today : (daily?.jobs_done || 0);
  const dColl = technician?.collected_today !== undefined ? technician.collected_today : (daily?.collected ?? dEarn);

  const wEarn = technician?.earnings_week !== undefined ? technician.earnings_week : (weekly?.earnings || 0);
  const wJobs = technician?.jobs_done_week !== undefined ? technician.jobs_done_week : (weekly?.jobs_done || 0);
  const wColl = technician?.collected_week !== undefined ? technician.collected_week : (weekly?.collected ?? wEarn);

  const mEarn = technician?.earnings_month !== undefined ? technician.earnings_month : (monthly?.earnings || 0);
  const mJobs = technician?.jobs_done_month !== undefined ? technician.jobs_done_month : (monthly?.jobs_done || 0);
  const mColl = technician?.collected_month !== undefined ? technician.collected_month : (monthly?.collected ?? mEarn);

  // Filter technician table rows
  const techRows = technician?.technician_id || technician?.id
    ? technicianPerformance.filter(
        t => String(t.technician_id || t.id) === String(technician.technician_id || technician.id)
      )
    : technicianPerformance;

  // Filter jobs ledger for period/tech if needed
  let jobsToRender = Array.isArray(jobsLedger) ? [...jobsLedger] : [];
  if (technician?.technician_id || technician?.id) {
    const tid = String(technician.technician_id || technician.id);
    jobsToRender = jobsToRender.filter(j => String(j.technician_id) === tid);
  }
  if (reportType === 'DAILY' && todayDate) {
    jobsToRender = jobsToRender.filter(j => (j.effective_date || j.scheduled_date || '').slice(0, 10) === todayDate);
  } else if (reportType === 'WEEKLY' && weekStart) {
    jobsToRender = jobsToRender.filter(j => {
      const d = (j.effective_date || j.scheduled_date || '').slice(0, 10);
      return d >= weekStart && d <= todayDate;
    });
  } else if (reportType === 'MONTHLY' && monthPrefix) {
    jobsToRender = jobsToRender.filter(j => (j.effective_date || j.scheduled_date || '').startsWith(monthPrefix));
  }

  // Create temporary offscreen A4 container
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px';
  wrapper.style.background = '#ffffff';
  wrapper.style.zIndex = '-1';

  wrapper.innerHTML = `
    <div id="pdf-report-a4-container" style="width: 760px; margin: 0 auto; padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #0f172a; background: #ffffff; box-sizing: border-box;">
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #423A8E; padding-bottom: 14px; margin-bottom: 18px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${
            companyLogo
              ? `<img src="${escapeHtml(companyLogo)}" crossorigin="anonymous" style="width: 64px; height: 64px; object-fit: contain; border-radius: 10px; border: 1px solid #e2e8f0; padding: 4px;" />`
              : `<div style="width: 56px; height: 56px; border-radius: 12px; background: #423A8E; color: #00CCCD; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">AC</div>`
          }
          <div>
            <div style="font-size: 20px; font-weight: 900; color: #1e1b4b;">${escapeHtml(companyName)}</div>
            ${companyAddress ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">${escapeHtml(companyAddress)}</div>` : ''}
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">
              ${companyPhone ? `Tel: ${escapeHtml(companyPhone)}` : ''}
              ${companyEmail ? ` • Email: ${escapeHtml(companyEmail)}` : ''}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background: #423A8E; color: #ffffff; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.8px;">
            Official Financial & Job Report
          </div>
          <div style="font-size: 11px; color: #334155; font-weight: 700; margin-top: 6px;">
            Report Date: ${escapeHtml(todayDate)}
          </div>
          <div style="font-size: 11px; color: #0f766e; font-weight: 800; margin-top: 2px;">
            Scope: ${technician?.name ? `Technician — ${escapeHtml(technician.name)}` : 'All Company Technicians'}
          </div>
        </div>
      </div>

      <!-- REPORT TITLE BANNER -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-left: 5px solid #423A8E; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px;">
        <div style="font-size: 15px; font-weight: 900; color: #0f172a;">${escapeHtml(reportTitle)}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 3px;">
          Complete summary of Daily (${escapeHtml(todayDate)}), Weekly (${escapeHtml(weekStart || 'Last 7 Days')} to ${escapeHtml(todayDate)}), and Monthly (${escapeHtml(monthPrefix)}) earnings & completed AC service jobs.
        </div>
      </div>

      <!-- 3 SUMMARY BOXES: DAILY, WEEKLY, MONTHLY -->
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <!-- DAILY -->
        <div style="flex: 1; border: 2px solid #10b981; background: #ecfdf5; border-radius: 10px; padding: 12px;">
          <div style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase;">
            Daily Earnings (Today • ${escapeHtml(todayDate)})
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #064e3b; margin-top: 6px;">
            ${formatLkr(dEarn)}
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #047857; margin-top: 6px; padding-top: 6px; border-top: 1px solid #a7f3d0; display: flex; justify-content: space-between;">
            <span>Jobs Done Today:</span>
            <span>${Number(dJobs || 0)} Job(s)</span>
          </div>
          <div style="font-size: 10px; color: #065f46; margin-top: 3px;">
            Collected: ${formatLkr(dColl)}
          </div>
        </div>

        <!-- WEEKLY -->
        <div style="flex: 1; border: 2px solid #6366f1; background: #eef2ff; border-radius: 10px; padding: 12px;">
          <div style="font-size: 10px; font-weight: 900; color: #3730a3; text-transform: uppercase;">
            Weekly Earnings (Last 7 Days)
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #1e1b4b; margin-top: 6px;">
            ${formatLkr(wEarn)}
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #4338ca; margin-top: 6px; padding-top: 6px; border-top: 1px solid #c7d2fe; display: flex; justify-content: space-between;">
            <span>Jobs Done This Week:</span>
            <span>${Number(wJobs || 0)} Job(s)</span>
          </div>
          <div style="font-size: 10px; color: #3730a3; margin-top: 3px;">
            Collected: ${formatLkr(wColl)}
          </div>
        </div>

        <!-- MONTHLY -->
        <div style="flex: 1; border: 2px solid #0284c7; background: #f0f9ff; border-radius: 10px; padding: 12px;">
          <div style="font-size: 10px; font-weight: 900; color: #075985; text-transform: uppercase;">
            Monthly Earnings (${escapeHtml(monthPrefix)})
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #0c4a6e; margin-top: 6px;">
            ${formatLkr(mEarn)}
          </div>
          <div style="font-size: 11px; font-weight: 800; color: #0369a1; margin-top: 6px; padding-top: 6px; border-top: 1px solid #bae6fd; display: flex; justify-content: space-between;">
            <span>Jobs Done This Month:</span>
            <span>${Number(mJobs || 0)} Job(s)</span>
          </div>
          <div style="font-size: 10px; color: #075985; margin-top: 3px;">
            Collected: ${formatLkr(mColl)}
          </div>
        </div>
      </div>

      <!-- TECHNICIAN PERFORMANCE BREAKDOWN TABLE -->
      ${
        techRows.length > 0
          ? `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 900; color: #1e1b4b; text-transform: uppercase; margin-bottom: 8px;">
            Technician Productivity & Earnings Breakdown (Daily / Weekly / Monthly)
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
            <thead>
              <tr style="background: #1e1b4b; color: #ffffff;">
                <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Technician Name</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #334155;">Daily Jobs</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #334155;">Daily Earning</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #334155;">Weekly Jobs</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #334155;">Weekly Earning</th>
                <th style="padding: 8px; text-align: center; border: 1px solid #334155;">Monthly Jobs</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #334155;">Monthly Earning</th>
                <th style="padding: 8px; text-align: right; border: 1px solid #334155;">All-Time Total</th>
              </tr>
            </thead>
            <tbody>
              ${techRows
                .map(
                  t => `
                <tr style="border-bottom: 1px solid #cbd5e1;">
                  <td style="padding: 7px 8px; border: 1px solid #e2e8f0; font-weight: 800;">
                    ${escapeHtml(t.name)}
                    <div style="font-size: 9.5px; color: #64748b; font-weight: 600;">${escapeHtml(t.mobile || t.email || '')}</div>
                  </td>
                  <td style="padding: 7px 8px; text-align: center; border: 1px solid #e2e8f0; font-weight: 800; color: #065f46;">${Number(t.jobs_done_today || 0)}</td>
                  <td style="padding: 7px 8px; text-align: right; border: 1px solid #e2e8f0; font-weight: 800; color: #065f46;">${formatLkr(t.earnings_today)}</td>
                  <td style="padding: 7px 8px; text-align: center; border: 1px solid #e2e8f0; font-weight: 800; color: #3730a3;">${Number(t.jobs_done_week || 0)}</td>
                  <td style="padding: 7px 8px; text-align: right; border: 1px solid #e2e8f0; font-weight: 800; color: #3730a3;">${formatLkr(t.earnings_week)}</td>
                  <td style="padding: 7px 8px; text-align: center; border: 1px solid #e2e8f0; font-weight: 800; color: #075985;">${Number(t.jobs_done_month || 0)}</td>
                  <td style="padding: 7px 8px; text-align: right; border: 1px solid #e2e8f0; font-weight: 800; color: #075985;">${formatLkr(t.earnings_month)}</td>
                  <td style="padding: 7px 8px; text-align: right; border: 1px solid #e2e8f0; font-weight: 900; color: #0f172a;">${formatLkr(t.earnings_total)} (${Number(t.jobs_done_total || 0)} Jobs)</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
          : ''
      }

      <!-- DETAILED SERVICE JOBS & EARNINGS LEDGER TABLE -->
      <div>
        <div style="font-size: 12px; font-weight: 900; color: #1e1b4b; text-transform: uppercase; margin-bottom: 8px;">
          Detailed Service Jobs & Earnings Ledger (${jobsToRender.length} Record(s))
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #f1f5f9; color: #334155;">
              <th style="padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Job # / Invoice</th>
              <th style="padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Date</th>
              <th style="padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Customer & AC Unit</th>
              <th style="padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Technician</th>
              <th style="padding: 7px; text-align: left; border: 1px solid #cbd5e1;">Service Package</th>
              <th style="padding: 7px; text-align: center; border: 1px solid #cbd5e1;">Status</th>
              <th style="padding: 7px; text-align: right; border: 1px solid #cbd5e1;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${
              jobsToRender.length === 0
                ? `<tr><td colspan="7" style="padding: 14px; text-align: center; color: #64748b; border: 1px solid #cbd5e1;">No jobs recorded in this filter scope.</td></tr>`
                : jobsToRender
                    .map(
                      j => `
                  <tr>
                    <td style="padding: 6px 7px; border: 1px solid #e2e8f0; font-weight: 800; color: #312e81;">
                      ${escapeHtml(j.job_number)}
                      ${j.invoice_number ? `<div style="font-size: 9px; color: #64748b;">Inv: ${escapeHtml(j.invoice_number)}</div>` : ''}
                    </td>
                    <td style="padding: 6px 7px; border: 1px solid #e2e8f0;">${escapeHtml(j.effective_date || j.scheduled_date || '')}</td>
                    <td style="padding: 6px 7px; border: 1px solid #e2e8f0;">
                      <div style="font-weight: 700;">${escapeHtml(j.customer_name || '')}</div>
                      <div style="font-size: 9px; color: #64748b;">${escapeHtml(j.ac_brand || '')} ${escapeHtml(j.ac_model || '')}</div>
                    </td>
                    <td style="padding: 6px 7px; border: 1px solid #e2e8f0; font-weight: 700;">${escapeHtml(j.technician_name || 'Unassigned')}</td>
                    <td style="padding: 6px 7px; border: 1px solid #e2e8f0;">${escapeHtml(j.display_package_name || j.service_type || 'AC Service')}</td>
                    <td style="padding: 6px 7px; text-align: center; border: 1px solid #e2e8f0; font-weight: 800; color: ${
                      j.status === 'COMPLETED' ? '#047857' : '#b45309'
                    };">${escapeHtml(j.status)}</td>
                    <td style="padding: 6px 7px; text-align: right; border: 1px solid #e2e8f0; font-weight: 800;">
                      ${formatLkr(j.earning_amount ?? j.invoice_total ?? j.display_package_price ?? 0)}
                    </td>
                  </tr>
                `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <!-- FOOTER -->
      <div style="margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9.5px; color: #64748b;">
        <span>Generated by ${escapeHtml(companyName)} • AC-Pro Management System</span>
        <span>Printed on ${escapeHtml(new Date().toLocaleString())}</span>
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  try {
    const html2pdf = await loadHtml2PdfLibrary();
    const targetEl = wrapper.querySelector('#pdf-report-a4-container');
    const opt = {
      margin: [8, 8, 8, 8],
      filename: `${fileSlug}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdf().set(opt).from(targetEl).save();
  } catch (err) {
    console.error('PDF generation failed, falling back to print:', err);
    window.print();
  } finally {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }
}
