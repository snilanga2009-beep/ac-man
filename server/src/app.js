const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const companyAdminRoutes = require('./routes/companyAdminRoutes');
const customerRoutes = require('./routes/customerRoutes');
const acUnitRoutes = require('./routes/acUnitRoutes');
const serviceJobRoutes = require('./routes/serviceJobRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const technicianPwaRoutes = require('./routes/technicianPwaRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const freelanceRoutes = require('./routes/freelanceRoutes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/company', companyAdminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/ac-units', acUnitRoutes);
app.use('/api/service-jobs', serviceJobRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/technician-pwa', technicianPwaRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/freelance', freelanceRoutes);

// Dynamic Network Info for Mobile Phone QR Code & Wi-Fi Access
app.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  const wifiIp =
    ips.find(i => /wi-fi|wlan|wireless/i.test(i.interface))?.address ||
    ips.find(i => i.address.startsWith('192.168.'))?.address ||
    ips[0]?.address ||
    '192.168.1.12';

  let tunnelUrl = process.env.PUBLIC_TUNNEL_URL || 'https://8e5315ac00e99f.lhr.life';
  try {
    const fs = require('fs');
    const path = require('path');
    const tunnelData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tunnel-url.json'), 'utf8'));
    if (tunnelData?.tunnel_url) tunnelUrl = tunnelData.tunnel_url;
  } catch (_) {}

  res.json({
    local_ip: wifiIp,
    wifi_url: `http://${wifiIp}:5173`,
    wifi_tech_url: `http://${wifiIp}:5173/technician/pwa`,
    tunnel_url: tunnelUrl,
    tunnel_tech_url: `${tunnelUrl}/technician/pwa`,
    interfaces: ips
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'AC-Pro Multi-Tenant SaaS',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production if built
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[UNHANDLED_ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
