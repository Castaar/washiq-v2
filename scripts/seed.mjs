// Seed script — run with: node scripts/seed.mjs
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local ────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI not found in .env.local');

await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB');

const db = mongoose.connection.db;

// ── Helpers ───────────────────────────────────────────────────
const ObjectId = mongoose.Types.ObjectId;

async function clearCollections() {
  const allCols = (await db.listCollections().toArray()).map((c) => c.name);
  for (const col of allCols) {
    if (['system.version'].includes(col)) continue;
    await db.collection(col).deleteMany({});
  }
  console.log('Cleared all collections');
}

// ─────────────────────────────────────────────────────────────
await clearCollections();

// ── Programs (same 5 for every site) ─────────────────────────
const PROGRAMS = [
  { name: 'Wash & Go', tier: 1 },
  { name: 'Basis',     tier: 2 },
  { name: 'Dodane',    tier: 3 },
  { name: 'All-in',    tier: 4 },
  { name: 'Gold',      tier: 5 },
];

// Chemicals per program — only defined for Ninove, other sites start empty
const NINOVE_CHEMICALS = {
  'Wash & Go': ['LC Shampoo Fresh', 'LC Truck Pre-Max', 'LC Active Foam Rasp', 'LC Dry'],
  'Basis':     ['LC Shampoo Fresh', 'LC Truck Pre-Max', 'LC Active Foam Rasp', 'LC Dry'],
  'Dodane':    ['LC Shampoo Fresh', 'LC Truck Pre-Max', 'LC Active Foam Rasp', 'GT Flavour Wax', 'LC Dry', 'Blob PS Polish'],
  'All-in':    ['LC Shampoo Fresh', 'LC Truck Pre-Max', 'LC Active Foam Rasp', 'GT Flavour Wax', 'LC Dry', 'Blob PS Polish'],
  'Gold':      ['LC Shampoo Fresh', 'LC Truck Pre-Max', 'LC Active Foam Rasp', 'GT Flavour Wax', 'LC Dry', 'LC Polish Intensive', 'Blob PS Polish'],
};

// ── Sites ─────────────────────────────────────────────────────
const SITES = [
  { name: 'Dodane Ninove',              location: 'Ninove' },
  { name: 'Dodane Sint-Pieters-Leeuw',  location: 'Sint-Pieters-Leeuw' },
  { name: 'Dodane Edingen',             location: 'Edingen' },
];

const createdSiteIds = [];

for (const site of SITES) {
  const siteId = new ObjectId();
  createdSiteIds.push(siteId);
  await db.collection('sites').insertOne({
    _id: siteId,
    name: site.name,
    location: site.location,
    setup_done: true,  // seeded sites are pre-configured
    created_at: new Date(),
  });

  const isNinove = site.name === 'Dodane Ninove';
  const programDocs = PROGRAMS.map((p) => ({
    _id: new ObjectId(),
    site_id: siteId,
    name: p.name,
    tier: p.tier,
    chemicals: isNinove ? (NINOVE_CHEMICALS[p.name] ?? []) : [],
    includes_cloth: false,
    cloth_cost: 0,
    chemical_ids: [],
  }));
  await db.collection('washprograms').insertMany(programDocs);

  console.log(`✓ ${site.name} (${siteId}) — programs: ${PROGRAMS.map((p) => p.name).join(', ')}`);
}

// ── Users ─────────────────────────────────────────────────────
const [ninoveSiteId, splSiteId, edingenSiteId] = createdSiteIds;
const devHash     = await bcrypt.hash('Cas#Dev@2026!', 12);
const ownerHash   = await bcrypt.hash('wachtwoord123', 12);
const empHash     = await bcrypt.hash('wachtwoord123', 12);

// Developer — platform admin, no site restriction
await db.collection('users').insertOne({
  _id: new ObjectId(),
  name: 'Alec Meganck',
  email: 'alec@castaar.com',
  password_hash: devHash,
  role: 'developer',
  site_ids: [],
  created_at: new Date(),
});
console.log('Developer: alec@castaar.com  /  Cas#Dev@2026!');

// Owner — access to all 3 sites
await db.collection('users').insertOne({
  _id: new ObjectId(),
  name: 'Demo Owner',
  email: 'owner@dodane.be',
  password_hash: ownerHash,
  role: 'owner',
  site_ids: [ninoveSiteId, splSiteId, edingenSiteId],
  created_at: new Date(),
});
console.log('Owner:     owner@dodane.be   /  wachtwoord123  (alle 3 sites)');

// Employees — one per site
const employees = [
  { name: 'Medewerker Ninove',             email: 'medewerker.ninove@dodane.be',   siteId: ninoveSiteId },
  { name: 'Medewerker Sint-Pieters-Leeuw', email: 'medewerker.spl@dodane.be',      siteId: splSiteId },
  { name: 'Medewerker Edingen',            email: 'medewerker.edingen@dodane.be',  siteId: edingenSiteId },
];
for (const emp of employees) {
  await db.collection('users').insertOne({
    _id: new ObjectId(),
    name: emp.name,
    email: emp.email,
    password_hash: empHash,
    role: 'employee',
    site_ids: [emp.siteId],
    created_at: new Date(),
  });
  console.log(`Employee:  ${emp.email}  /  wachtwoord123`);
}

// ── Done ──────────────────────────────────────────────────────
console.log('\n✓ Seed complete! 3 sites, 5 programs each.');
await mongoose.disconnect();
