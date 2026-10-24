const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

const pass123 = bcrypt.hashSync('password123', 10);

// Check if kasun@coolair.lk exists
const existingKasunCoolair = db.prepare('SELECT id FROM users WHERE email = ?').get('kasun@coolair.lk');
if (!existingKasunCoolair) {
  db.prepare(`
    INSERT INTO users (company_id, email, username, name, role, status, password_hash)
    VALUES (1, 'kasun@coolair.lk', 'kasun_coolair', 'Kasun Perera', 'TECHNICIAN', 'ACTIVE', ?)
  `).run(pass123);
  console.log('[SEED] Created kasun@coolair.lk');
} else {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(pass123, existingKasunCoolair.id);
  console.log('[SEED] Updated kasun@coolair.lk');
}
