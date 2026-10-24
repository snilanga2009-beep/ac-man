// Utility for A4 PDF Download, Clean A4 Print Format, and Direct WhatsApp Sharing

let html2pdfLoaded = null;

function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  if (html2pdfLoaded) return html2pdfLoaded;

  html2pdfLoaded = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    script.onload = () => resolve(window.html2pdf);
    script.onerror = err => reject(err);
    document.head.appendChild(script);
  });

  return html2pdfLoaded;
}

/**
 * Generates and downloads a true A4 portrait PDF file (e.g. QT-2026-00001.pdf)
 */
export async function downloadQuotationPdf(quotation, elementId = 'quotation-a4-sheet') {
  const el = document.getElementById(elementId);
  if (!el) {
    printQuotationA4(elementId, quotation?.quotation_number);
    return;
  }

  const fileName = `${quotation?.quotation_number || 'Quotation'}.pdf`;

  try {
    const html2pdf = await loadHtml2Pdf();
    const opt = {
      margin: [8, 8, 8, 8],
      filename: fileName,
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

    await html2pdf().set(opt).from(el).save();
    return true;
  } catch (err) {
    console.warn('Fallback to native A4 PDF print dialog:', err);
    printQuotationA4(elementId, fileName);
    return false;
  }
}

/**
 * Opens a dedicated A4 portrait print preview window so ONLY the A4 sheet prints cleanly
 */
export function printQuotationA4(elementId = 'quotation-a4-sheet', title = 'AC Quotation A4') {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML)
    .join('\n');

  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${styles}
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #${elementId} {
            width: 190mm !important;
            max-width: 190mm !important;
            min-height: auto !important;
            margin: 0 auto !important;
            padding: 6mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        ${el.outerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Formats Sri Lankan or international phone numbers for wa.me links
 */
export function formatWhatsAppPhone(rawPhone) {
  if (!rawPhone) return '';
  let digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '94' + digits.slice(1);
  }
  return digits;
}

/**
 * Builds the WhatsApp (wa.me) URL synchronously for a quotation
 */
export function getQuotationWhatsAppUrl(quotation) {
  if (!quotation) return 'https://wa.me/';

  const phone = formatWhatsAppPhone(
    quotation.customer_whatsapp || quotation.customer_phone || ''
  );

  const approvalUrl = `${window.location.origin}/quotation/${quotation.quotation_number}/approve?token=${quotation.secure_token}`;

  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const itemLines = items.length > 0
    ? items
        .map(
          (it, idx) =>
            `${idx + 1}. *${it.item_name}* (${it.quantity} ${it.unit || 'Unit'}) - Rs. ${Number(it.total || 0).toLocaleString()}`
        )
        .join('\n')
    : `• Estimated AC Service (${quotation.item_count || 1} item) - Rs. ${Number(quotation.grand_total || 0).toLocaleString()}`;

  const acLine = quotation.ac_brand
    ? `❄️ *AC Unit:* ${quotation.ac_brand} ${quotation.ac_model || ''} ${quotation.serial_number ? `(SN: ${quotation.serial_number})` : ''}\n`
    : '';

  const messageLines = [
    `*${quotation.company_name || 'AC-Pro Service'} — Official Quotation*`,
    `📄 *Quotation No:* ${quotation.quotation_number} (v${quotation.current_version || 1})`,
    `👤 *Customer:* ${quotation.customer_name || 'Valued Customer'}`,
    acLine ? acLine.trim() : null,
    `📅 *Issue Date:* ${quotation.quotation_date} | *Valid Until:* ${quotation.valid_until}`,
    ``,
    `*Quotation Breakdown:*`,
    itemLines,
    `--------------------------------`,
    `Subtotal: Rs. ${Number(quotation.subtotal || quotation.grand_total || 0).toLocaleString()}`,
    Number(quotation.discount) > 0 ? `Discount: - Rs. ${Number(quotation.discount).toLocaleString()}` : null,
    Number(quotation.tax) > 0 ? `Tax: + Rs. ${Number(quotation.tax).toLocaleString()}` : null,
    `💰 *ESTIMATED TOTAL: LKR ${Number(quotation.grand_total || 0).toLocaleString()}*`,
    ``,
    `✅ *View A4 Quotation & Approve Online:*`,
    approvalUrl,
    ``,
    `📞 Questions? Contact ${quotation.company_name || 'us'} at ${quotation.company_phone || ''}`
  ].filter(line => line !== null);

  const encodedText = encodeURIComponent(messageLines.join('\n'));
  return phone
    ? `https://wa.me/${phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Opens WhatsApp (wa.me) with a rich itemized quotation summary + secure customer approval link.
 * Works on both Mobile (Android/iOS/PWA) and Desktop without popup blocker issues.
 */
export function shareQuotationOnWhatsApp(quotation) {
  if (!quotation) return;
  const waUrl = getQuotationWhatsAppUrl(quotation);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  if (isMobile) {
    window.location.href = waUrl;
    return;
  }

  const win = window.open(waUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    window.location.href = waUrl;
  }
}
