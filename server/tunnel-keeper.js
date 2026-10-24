const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

let activeTunnelUrl = null;
let keepAliveInterval = null;

function updateTunnelFiles(url) {
  if (!url || url === activeTunnelUrl) return;
  activeTunnelUrl = url;
  const techUrl = `${url}/technician/pwa`;
  console.log(`[TUNNEL-KEEPER] Active HTTPS Tunnel: ${techUrl}`);

  try {
    fs.writeFileSync(
      path.join(__dirname, 'tunnel-url.json'),
      JSON.stringify({ tunnel_url: url, tunnel_tech_url: techUrl, updated_at: new Date().toISOString() }, null, 2),
      'utf8'
    );
  } catch (e) {
    console.error('[TUNNEL-KEEPER] Failed writing tunnel-url.json:', e.message);
  }

  try {
    const clientConfigPath = path.join(__dirname, '..', 'client', 'src', 'utils', 'tunnelConfig.js');
    const content = `export const LIVE_TUNNEL_URL = '${url}';\nexport const LIVE_TUNNEL_TECH_URL = '${techUrl}';\n`;
    fs.writeFileSync(clientConfigPath, content, 'utf8');
  } catch (e) {
    console.error('[TUNNEL-KEEPER] Failed writing tunnelConfig.js:', e.message);
  }
}

function pingTunnel() {
  if (!activeTunnelUrl) return;
  const target = `${activeTunnelUrl}/api/health`;
  https
    .get(target, (res) => {
      res.resume();
    })
    .on('error', () => {});
}

function startTunnel() {
  console.log('[TUNNEL-KEEPER] Starting localhost.run HTTPS tunnel -> 127.0.0.1:5173 ...');
  const child = spawn(
    'ssh',
    [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=15',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-R', '80:127.0.0.1:5173',
      'nokey@localhost.run'
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const handleChunk = (chunk) => {
    const text = chunk.toString();
    const matches = text.match(/https:\/\/[a-z0-9]+\.lhr\.life/gi);
    if (matches && matches.length > 0) {
      const latest = matches[matches.length - 1];
      updateTunnelFiles(latest);
      setTimeout(pingTunnel, 2000);
    }
  };

  child.stdout.on('data', handleChunk);
  child.stderr.on('data', handleChunk);

  child.on('close', (code) => {
    console.log(`[TUNNEL-KEEPER] Tunnel exited (code ${code}). Reconnecting in 3s...`);
    setTimeout(startTunnel, 3000);
  });

  child.on('error', (err) => {
    console.error('[TUNNEL-KEEPER] Spawn error:', err.message);
    setTimeout(startTunnel, 5000);
  });
}

keepAliveInterval = setInterval(pingTunnel, 35000);
startTunnel();
