// Reset setup_done for all sites linked to a given user email.
// Usage: node scripts/reset-setup.mjs support@castaar.com
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

const email = process.argv[2];
if (!email) { console.error('Usage: node scripts/reset-setup.mjs <email>'); process.exit(1); }

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;

const user = await db.collection('users').findOne({ email });
if (!user) { console.error(`No user found for email: ${email}`); process.exit(1); }

const siteIds = user.site_ids ?? [];
if (!siteIds.length) {
  console.log(`User ${email} has no linked sites — nothing to reset.`);
  process.exit(0);
}

const result = await db.collection('sites').updateMany(
  { _id: { $in: siteIds } },
  { $set: { setup_done: false } },
);

console.log(`Reset setup_done for ${result.modifiedCount} site(s) linked to ${email}.`);
await mongoose.disconnect();
