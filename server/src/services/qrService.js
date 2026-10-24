const QRCode = require('qrcode');

async function generateAcQrDataUrl(qrCodeId) {
  try {
    const payload = JSON.stringify({
      app: 'AC-Pro',
      qr_id: qrCodeId,
      verify_url: `/verify/${qrCodeId}`
    });
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      scale: 8,
      color: {
        dark: '#0284c7',
        light: '#ffffff'
      }
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

module.exports = {
  generateAcQrDataUrl
};
