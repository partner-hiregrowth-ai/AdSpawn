function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  jwtSecret: requireEnv('JWT_SECRET'),
} as const;

// One readable boot-time report of configuration problems. Hard requirements
// throw above; everything here degrades a feature, so warn loudly instead of
// refusing to start.
export function validateEnvironment(): void {
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL) warnings.push('DATABASE_URL is not set — Prisma will fail on first query.');
  if (!process.env.FB_APP_ID || process.env.FB_APP_ID === 'your_facebook_app_id') {
    warnings.push('FB_APP_ID is missing/default — long-lived token exchange and data-deletion callback are disabled.');
  }
  if (!process.env.FB_APP_SECRET) warnings.push('FB_APP_SECRET is missing — token exchange and data-deletion signature checks are disabled.');
  if (!process.env.TOKEN_ENCRYPTION_KEY) warnings.push('TOKEN_ENCRYPTION_KEY is missing — Facebook tokens will be stored in PLAINTEXT.');

  const provider = (process.env.AI_PROVIDER || 'claude').toLowerCase();
  const providerKey: Record<string, string> = {
    claude: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GOOGLE_API_KEY', groq: 'GROQ_API_KEY',
  };
  const requiredKey = providerKey[provider];
  if (requiredKey && !process.env[requiredKey]) {
    warnings.push(`AI_PROVIDER=${provider} but ${requiredKey} is not set — AI Create will fail.`);
  }

  if (warnings.length > 0) {
    console.warn('======== ENVIRONMENT WARNINGS ========');
    for (const w of warnings) console.warn(`  [ENV] ${w}`);
    console.warn('======================================');
  }
}
