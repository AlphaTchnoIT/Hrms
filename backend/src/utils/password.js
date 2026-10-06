import crypto from 'crypto';

// Readable temporary password that meets the password rules, e.g. "Kite-4827-Ramp"
const WORDS = ['Amber', 'Bridge', 'Cedar', 'Delta', 'Ember', 'Falcon', 'Harbor', 'Indigo', 'Juniper', 'Kite', 'Lumen', 'Maple', 'Nova', 'Orbit', 'Pine', 'Quartz', 'Ramp', 'Summit', 'Tide', 'Willow'];

export function generateTemporaryPassword() {
  const word = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${word()}-${crypto.randomInt(1000, 10000)}-${word()}`;
}

// Token emailed to the user (raw) and its sha256 stored in the database
export function createResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
