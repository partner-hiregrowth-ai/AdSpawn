import rateLimit from 'express-rate-limit';

// Auth endpoint: low limit to deter credential-stuffing / token-spray.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
});

// Bulk endpoints: protect against accidental hammering and rate-limit blast.
// 30/min is generous for normal use (a user clicking bulk-publish a few times)
// but stops scripted floods.
export const bulkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many bulk requests. Slow down for a minute.' },
});
