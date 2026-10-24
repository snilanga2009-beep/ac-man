const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const app = require('./app');
const cron = require('node-cron');
const { processDueReminders } = require('./services/reminderEngine');

const PORT = process.env.PORT || 5070;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 AC-Pro SaaS Server running on http://localhost:${PORT}`);
  console.log(`👤 Master Super Admin: superadmin@acpro.com / superadmin123`);
  console.log(`==================================================`);
});

// Run Reminder Engine daily at 08:00 AM (or every hour for background check)
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Running daily Service Reminder Engine...');
  try {
    const results = await processDueReminders();
    console.log(`[CRON] Processed ${results.length} service due reminders.`);
  } catch (err) {
    console.error('[CRON_ERROR]', err);
  }
});
