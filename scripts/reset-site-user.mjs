// Reset script — fresh start for a specific site + user
// Run with: node scripts/reset-site-user.mjs
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI not found in .env.local');

const SITE_NAME  = 'Castaar';
const USER_EMAIL = 'support@castaar.com';

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

// ── Find site ─────────────────────────────────────────────────
const site = await db.collection('sites').findOne({ name: { $regex: new RegExp(`^${SITE_NAME}$`, 'i') } });
if (!site) {
  console.error(`Site "${SITE_NAME}" not found — check the exact name in the DB.`);
  process.exit(1);
}
const siteId = site._id;
console.log(`Found site: ${site.name} (${siteId})`);

// ── Find user ─────────────────────────────────────────────────
const user = await db.collection('users').findOne({ email: USER_EMAIL });
if (!user) {
  console.error(`User "${USER_EMAIL}" not found.`);
  process.exit(1);
}
console.log(`Found user: ${user.name} (${user._id})`);

// ── Reset site document ───────────────────────────────────────
await db.collection('sites').updateOne(
  { _id: siteId },
  { $set: { setup_done: false, start_car_count: 0 } },
);
console.log('✓ Site: setup_done=false, start_car_count=0');

// ── Delete operational records for this site ──────────────────
const collections = [
  'weeklyentries',
  'dailychecklists',
  'stockdeliveries',
  'maintenancelogs',
  'incidentschades',
  'incidentehbos',
  'defects',
  'priceconfigs',
];

for (const col of collections) {
  const result = await db.collection(col).deleteMany({ site_id: siteId });
  console.log(`✓ ${col}: deleted ${result.deletedCount} records`);
}

// ── Reset chemical stock quantities (keep the items, zero the stock) ──
const stockResult = await db.collection('chemicalstocks').updateMany(
  { site_id: siteId },
  { $set: { current_stock: 0 } },
);
console.log(`✓ chemicalstocks: reset ${stockResult.modifiedCount} items to 0`);

// ── Reset maintenance task baselines ──────────────────────────
const taskResult = await db.collection('maintenancetasks').updateMany(
  { site_id: siteId },
  { $unset: { last_done_at: '', washes_at_last_done: '' }, $set: { is_overdue: false } },
);
console.log(`✓ maintenancetasks: cleared baselines on ${taskResult.modifiedCount} tasks`);

// ── Reset user ────────────────────────────────────────────────
await db.collection('users').updateOne(
  { _id: user._id },
  { $set: { help_seen: false } },
);
console.log('✓ User: help_seen=false');

// ── Clear push subscriptions for this user ────────────────────
const pushResult = await db.collection('pushsubscriptions').deleteMany({ user_id: user._id });
console.log(`✓ pushsubscriptions: deleted ${pushResult.deletedCount} for user`);

console.log('\n✓ Reset complete. Fresh start ready.');
await mongoose.disconnect();
