// Drops the stale PascalCase-named collections, keeping only the
// lowercase-plural ones that Mongoose uses by default.
// Run with: node scripts/cleanup-collections.mjs
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

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

// These are the stale PascalCase collections to drop
const toDrop = [
  'ChemicalStock',
  'DailyChecklist',
  'MaintenanceLog',
  'MaintenanceTask',
  'PriceConfig',
  'Site',
  'StockDelivery',
  'User',
  'WashProgram',
  'WeeklyEntry',
];

const existing = (await db.listCollections().toArray()).map((c) => c.name);

for (const name of toDrop) {
  if (existing.includes(name)) {
    await db.collection(name).drop();
    console.log(`Dropped: ${name}`);
  } else {
    console.log(`Skipped (not found): ${name}`);
  }
}

console.log('\n✓ Cleanup complete.');
await mongoose.disconnect();
