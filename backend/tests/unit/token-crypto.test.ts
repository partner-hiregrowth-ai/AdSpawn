import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken } from '../../src/utils/tokenCrypto';

const KEY = 'a'.repeat(64); // 32 bytes hex

describe('tokenCrypto', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = originalKey;
  });

  it('round-trips a token', () => {
    const stored = encryptToken('EAABsbCS1234VerySecretToken');
    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain('VerySecretToken');
    expect(decryptToken(stored)).toBe('EAABsbCS1234VerySecretToken');
  });

  it('produces a different ciphertext per call (random IV)', () => {
    expect(encryptToken('same')).not.toBe(encryptToken('same'));
  });

  it('passes legacy plaintext rows through decryptToken unchanged', () => {
    expect(decryptToken('EAABlegacyPlaintext')).toBe('EAABlegacyPlaintext');
  });

  it('returns null for null/undefined', () => {
    expect(decryptToken(null)).toBeNull();
    expect(decryptToken(undefined)).toBeNull();
  });

  it('stores plaintext (with warning) when no key is configured', () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(encryptToken('tok')).toBe('tok');
  });

  it('rejects a malformed key', () => {
    process.env.TOKEN_ENCRYPTION_KEY = 'tooshort';
    expect(() => encryptToken('tok')).toThrow(/32 bytes/);
  });

  it('throws when an encrypted row exists but the key is missing', () => {
    const stored = encryptToken('tok');
    delete process.env.TOKEN_ENCRYPTION_KEY;
    expect(() => decryptToken(stored)).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});
