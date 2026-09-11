import fs from 'fs';
import mongoose from 'mongoose';
const env = fs.readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
await mongoose.connect(process.env.MONGODB_URI);
const Site = mongoose.connection.collection('sites');
const site = await Site.findOne({ name: 'Dodane Ninove' });
const Defect = mongoose.connection.collection('defects');
// 1x1 red pixel PNG data URI
const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const res = await Defect.insertOne({
  site_id: site._id, reported_by_name: 'QA', omschrijving: 'PHOTO TEST panne',
  ernst: 'medium', is_resolved: false, photos: [px, px], created_at: new Date(),
});
console.log('site', site._id.toString(), 'defect', res.insertedId.toString());
await mongoose.disconnect();
