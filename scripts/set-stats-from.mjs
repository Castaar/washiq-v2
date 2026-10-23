// Sets the first day of the current owner's figures for a site (e.g. after a takeover).
// Ingaven, stock counts and energy bills before that day stay in the database but are
// hidden from dashboard, historiek, ranking and logboek totals (see lib/statsFrom.ts).
// Usage:
//   export $(grep MONGODB_URI .env.local | xargs) && node scripts/set-stats-from.mjs "<site name>" <YYYY-MM-DD>
//   ... node scripts/set-stats-from.mjs "<site name>" none   # remove it again
import mongoose from 'mongoose';

const [name, date] = process.argv.slice(2);
if (!name || !(date === 'none' || /^\d{4}-\d{2}-\d{2}$/.test(date ?? ''))) {
  console.error('Usage: node scripts/set-stats-from.mjs "<site name>" <YYYY-MM-DD|none>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const sites = mongoose.connection.db.collection('sites');
const site = await sites.findOne({ name });
if (!site) {
  console.error(`Site not found: ${name}`);
  process.exit(1);
}

if (date === 'none') {
  await sites.updateOne({ _id: site._id }, { $unset: { stats_from: '' } });
} else {
  await sites.updateOne({ _id: site._id }, { $set: { stats_from: date } });
}
console.log(`${name}: stats_from =`, date === 'none' ? '(none)' : date);

await mongoose.disconnect();
