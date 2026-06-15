// Full site reset — wipes all operational data for a site and marks setup_done: false.
// Usage: node scripts/reset-site.mjs "Dodane Ninove"
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

const siteName = process.argv[2];
if (!siteName) { console.error('Usage: node scripts/reset-site.mjs "<site name>"'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const site = await db.collection('sites').findOne({ name: siteName });
if (!site) { console.error(`No site found with name: "${siteName}"`); process.exit(1); }

const siteId = site._id;
console.log(`Found site: ${site.name} (${siteId})`);

// Collections with a single site_id field
const singleSiteCollections = [
  'priceconfigs',
  'washprograms',
  'weeklyentries',
  'chemicalstocks',
  'stockdeliveries',
  'maintenancetasks',
  'maintenancelogs',
  'dailychecklists',
  'incidentschades',
  'incidentehbos',
  'defects',
  'activitylogs',
  'energybills',
  'attendancelogs',
  'opdrachts',
  'plannings',
  'announcements',
];

for (const col of singleSiteCollections) {
  const exists = await db.listCollections({ name: col }).hasNext();
  if (!exists) continue;
  const result = await db.collection(col).deleteMany({ site_id: siteId });
  if (result.deletedCount > 0) console.log(`  ✓ ${col}: removed ${result.deletedCount} document(s)`);
}

// Reset the site itself
await db.collection('sites').updateOne(
  { _id: siteId },
  {
    $set: {
      setup_done: false,
      start_car_count: 0,
    },
  },
);
console.log(`  ✓ sites: reset setup_done + start_car_count`);

await mongoose.disconnect();
console.log(`\nDone — "${siteName}" has been fully reset.`);
