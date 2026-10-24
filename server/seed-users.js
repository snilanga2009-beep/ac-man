const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

const pass123 = bcrypt.hashSync('password123', 10);
const adminPass = bcrypt.hashSync('adminPassword123', 10);
const kasunPass = bcrypt.hashSync('kasunPassword123', 10);

// Ensure admin@coolair.lk exists
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get('admin@coolair.lk', 'cooladmin');
if (!existingAdmin) {
  db.prepare(`
    INSERT INTO users (company_id, email, username, name, role, status, password_hash)
    VALUES (1, 'admin@coolair.lk', 'cooladmin', 'CoolMate Admin', 'COMPANY_ADMIN', 'ACTIVE', ?)
  `).run(pass123);
  console.log('[SEED] Created admin@coolair.lk');
} else {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pass123, existingAdmin.id);
  console.log('[SEED] Updated password for admin@coolair.lk');
}

// Ensure ruwan@coolair.lk exists
const existingRuwan = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get('ruwan@coolair.lk', 'ruwan_tech');
if (!existingRuwan) {
  db.prepare(`
    INSERT INTO users (company_id, email, username, name, role, status, password_hash)
    VALUES (1, 'ruwan@coolair.lk', 'ruwan_tech', 'Ruwan Kumara', 'TECHNICIAN', 'ACTIVE', ?)
  `).run(pass123);
  console.log('[SEED] Created ruwan@coolair.lk');
} else {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pass123, existingRuwan.id);
  console.log('[SEED] Updated password for ruwan@coolair.lk');
}

// Also update abcadmin and kasun_tech to accept password123 as well if desired
const existingAbc = db.prepare('SELECT id FROM users WHERE username = ?').get('abcadmin');
if (existingAbc) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pass123, existingAbc.id);
  console.log('[SEED] Set password123 for abcadmin');
}

const existingKasun = db.prepare('SELECT id FROM users WHERE username = ?').get('kasun_tech');
if (existingKasun) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pass123, existingKasun.id);
  console.log('[SEED] Set password123 for kasun_tech');
}

console.log('[SEED] Seeding completed.');
