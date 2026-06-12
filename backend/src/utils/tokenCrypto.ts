import crypto from 'crypto';

// At-rest encryption for Facebook access tokens (AES-256-GCM).
// Stored format: enc:v1:<iv b64>:<auth tag b64>:<ciphertext b64>
// Values without the prefix are treated as legacy plaintext rows and pass
// through decryptToken unchanged; they get encrypted on the next login write.
const PREFIX = 'enc:v1:';

let warnedMissingKey = false;

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    if (!warnedMissingKey) {
      console.error(
        '[SECURITY] TOKEN_ENCRYPTION_KEY is not set — Facebook access tokens are being stored in PLAINTEXT. ' +
        'Generate one with `openssl rand -hex 32` and set it before going to production.'
      );
      warnedMissingKey = true;
    }
    return null;
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes (use: openssl rand -hex 32)');
  }
  return key;
}

export function encryptToken(plain: string): string {
  const key = getKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext row
  const key = getKey();
  if (!key) {
    throw new Error('Encrypted token found but TOKEN_ENCRYPTION_KEY is not set');
  }
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
