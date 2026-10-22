// Registers a machine counter reset (tunnel counter set back to 0) for a site.
// The app keeps one continuous counter: later readings get the end value added back.
// Usage:
//   export $(grep MONGODB_URI .env.local | xargs) && node scripts/set-counter-reset.mjs "<site name>" <YYYY-MM-DD> <end value>
import mongoose from 'mongoose';

const [name, date, endRaw] = process.argv.slice(2);
const endValue = Number(endRaw);
if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(endValue) || endValue <= 0) {
  console.error('Usage: node scripts/set-counter-reset.mjs "<site name>" <YYYY-MM-DD> <end value>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const sites = mongoose.connection.db.collection('sites');
const site = await sites.findOne({ name });
if (!site) {
  console.error(`Site not found: ${name}`);
  process.exit(1);
}

const resets = (site.counter_resets ?? []).filter((r) => r.date !== date);
resets.push({ date, end_value: endValue });
resets.sort((a, b) => a.date.localeCompare(b.date));
await sites.updateOne({ _id: site._id }, { $set: { counter_resets: resets } });
console.log(`${name}: counter_resets =`, JSON.stringify(resets));

await mongoose.disconnect();
