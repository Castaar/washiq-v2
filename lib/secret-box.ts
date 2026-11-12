import crypto from 'crypto';

// Encrypts third-party credentials (API keys, passwords) at rest with AES-256-GCM.
// The key is derived from INTEGRATIONS_SECRET, or from SESSION_SECRET when that is not
// set. Changing the secret makes stored credentials unreadable: they then have to be
// entered again in Instellingen → Koppelingen.
function key(): Buffer {
  const base = process.env.INTEGRATIONS_SECRET || process.env.SESSION_SECRET;
  if (!base) throw new Error('INTEGRATIONS_SECRET or SESSION_SECRET is not set');
  return Buffer.from(crypto.hkdfSync('sha256', base, 'glosiv', 'integrations-v1', 32));
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !enc) throw new Error('Unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}
