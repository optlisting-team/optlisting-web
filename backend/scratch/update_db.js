process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('No DATABASE_URL'); process.exit(1); }
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query('ALTER TABLE deletion_logs ADD COLUMN IF NOT EXISTS sku TEXT;');
    console.log('SUCCESS: Column added.');
  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await client.end();
  }
}
run();
