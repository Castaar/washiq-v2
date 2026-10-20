// Creates (or refreshes) the three read-only demo accounts. Usage:
//   export $(grep MONGODB_URI .env.local | xargs) && node scripts/create-demo-users.mjs [--reset-password]
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const users = db.collection('users');
const siteIds = (await db.collection('sites').find().project({ _id: 1 }).toArray()).map((s) => s._id);

const resetPassword = process.argv.includes('--reset-password');
const password = crypto.randomBytes(9).toString('base64url');
const hash = await bcrypt.hash(password, 10);

const DEMOS = [
  { role: 'owner', name: 'Demo Eigenaar', email: 'demo@glosiv.be' },
  { role: 'technician', name: 'Demo Technieker', email: 'demo.technieker@glosiv.be' },
  { role: 'employee', name: 'Demo Werknemer', email: 'demo.werknemer@glosiv.be' },
];

for (const d of DEMOS) {
  const existing = await users.findOne({ email: d.email });
  const base = { name: d.name, role: d.role, site_ids: siteIds, is_demo: true, is_active: true, help_seen: true, birthday: '', whatsapp: '' };
  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: { ...base, ...(resetPassword ? { password_hash: hash } : {}) } });
    console.log('updated', d.email, resetPassword ? '(password reset)' : '(password unchanged)');
  } else {
    await users.insertOne({ ...base, email: d.email, password_hash: hash, created_at: new Date(), pending_deletion_at: null });
    console.log('created', d.email);
  }
}
if (resetPassword || !(await users.findOne({ email: 'demo@glosiv.be', password_hash: { $exists: false } }))) {
  console.log('\nLOGIN  demo@glosiv.be  /  ' + password + '   (only valid when the account was created or reset in this run)');
}
await mongoose.disconnect();
