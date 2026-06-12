import { Request, Response } from 'express';
import { prisma, withRetry } from '../prisma';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { encryptToken } from '../utils/tokenCrypto';

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

function signToken(userId: string, teamId: string): string {
  return jwt.sign({ userId, teamId }, config.jwtSecret, { expiresIn: '60d' });
}

export const loginWithFacebook = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  try {
    // Token goes in params, never in the URL string — URLs end up in logs.
    const fbResponse = await axios.get('https://graph.facebook.com/me', {
      params: { fields: 'id,name,email', access_token: accessToken },
    });
    const { id, name, email } = fbResponse.data;

    let tokenToStore = accessToken;
    let tokenExpiresAt: Date | undefined;
    
    const rawAppId = process.env.FB_APP_ID;
    const rawAppSecret = process.env.FB_APP_SECRET;
    const appId = rawAppId?.replace(/^["']|["']$/g, "")?.trim();
    const appSecret = rawAppSecret?.replace(/^["']|["']$/g, "")?.trim();

    if (appId && appSecret && appId !== "your_facebook_app_id") {
      try {
        const exchangeResponse = await axios.get('https://graph.facebook.com/oauth/access_token', {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: accessToken,
          },
        });
        tokenToStore = exchangeResponse.data.access_token;
        if (exchangeResponse.data.expires_in) {
          tokenExpiresAt = new Date(Date.now() + exchangeResponse.data.expires_in * 1000);
        }
        console.log('[Auth] Successfully exchanged for long-lived token');
      } catch (exchangeError: any) {
        console.warn('[Auth] Could not exchange for long-lived token, using original:', exchangeError?.response?.data || exchangeError?.message);
      }
    } else {
      console.warn('[Auth] Skipping long-lived token exchange — missing or default FB_APP_ID/SECRET');
    }

    let user = await withRetry(() => prisma.user.findUnique({
      where: { facebookId: id },
      include: { ownedTeam: true }
    }));

    // Tokens are encrypted at rest; legacy plaintext rows are re-encrypted on
    // the next login because we always rewrite the token here.
    const storedToken = encryptToken(tokenToStore);

    if (!user) {
      user = await withRetry(() => prisma.user.create({
        data: { facebookId: id, name, email, accessToken: storedToken, accessTokenExpiresAt: tokenExpiresAt, role: 'admin' },
        include: { ownedTeam: true }
      }));
    } else {
      user = await withRetry(() => prisma.user.update({
        where: { id: user!.id },
        data: { name, email, accessToken: storedToken, accessTokenExpiresAt: tokenExpiresAt },
        include: { ownedTeam: true }
      }));
    }

    let teamId = user.teamId;
    if (!user.ownedTeam) {
      console.log(`[Auth] User ${user.id} has no ownedTeam, creating one...`);
      const team = await withRetry(() => prisma.team.create({
        data: {
          name: `${name || 'My'}'s Team`,
          inviteCode: generateInviteCode(),
          ownerId: user.id,
        }
      }));
      await withRetry(() => prisma.user.update({
        where: { id: user.id },
        data: { teamId: team.id, role: 'admin' },
      }));
      teamId = team.id;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[Auth] JWT_SECRET is missing from environment');
      return res.status(500).json({ message: 'Server configuration error: JWT_SECRET missing' });
    }

    const token = signToken(user.id, teamId!);
    res.json({ token, user: { id: user.id, facebookId: user.facebookId, name: user.name, email: user.email, role: user.role, teamId } });
  } catch (error: any) {
    console.error('[Auth] FB Login Error Details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      response: error?.response?.data
    });
    const prismaCode = error?.code;
    if (prismaCode === 'P1001' || prismaCode === 'P1017' || prismaCode === 'P1002') {
      return res.status(503).json({ message: 'Database unavailable. Please try again in a moment.' });
    }
    if (axios.isAxiosError(error) && error.response?.status === 400) {
      return res.status(401).json({ message: 'Invalid Facebook token' });
    }
    res.status(500).json({ message: 'Login failed', detail: error?.message });
  }
};

// ─── Facebook Data Deletion Callback ───
// Required by Meta App Review. Facebook POSTs a signed_request when a user
// requests deletion of their data; we must anonymize the user and respond with
// a status URL + confirmation code.
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

function parseSignedRequest(signedRequest: string, appSecret: string): any | null {
  const dot = signedRequest.indexOf('.');
  if (dot < 0) return null;
  const encodedSig = signedRequest.slice(0, dot);
  const payload = signedRequest.slice(dot + 1);

  const fromBase64Url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const sig = fromBase64Url(encodedSig);
  const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();
  if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;

  try {
    return JSON.parse(fromBase64Url(payload).toString('utf8'));
  } catch {
    return null;
  }
}

export const facebookDataDeletion = async (req: Request, res: Response) => {
  const signedRequest = req.body?.signed_request;
  const appSecret = process.env.FB_APP_SECRET?.replace(/^["']|["']$/g, '')?.trim();
  if (!signedRequest || !appSecret) {
    return res.status(400).json({ error: 'Missing signed_request' });
  }

  const data = parseSignedRequest(String(signedRequest), appSecret);
  if (!data?.user_id) {
    return res.status(400).json({ error: 'Invalid signed_request' });
  }

  const confirmationCode = crypto.randomBytes(8).toString('hex');
  try {
    const user = await prisma.user.findUnique({ where: { facebookId: String(data.user_id) } });
    if (user) {
      // Anonymize: revoke token, strip PII, detach the Facebook identity.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accessToken: null,
          accessTokenExpiresAt: null,
          email: null,
          name: 'Deleted User',
          facebookId: `deleted_${confirmationCode}`,
        },
      });
      console.log(`[DataDeletion] Anonymized user ${user.id} (confirmation ${confirmationCode})`);
    } else {
      console.log(`[DataDeletion] No user found for facebookId ${data.user_id} (confirmation ${confirmationCode})`);
    }
  } catch (error: any) {
    console.error('[DataDeletion] Failed:', error?.message);
    return res.status(500).json({ error: 'Deletion failed' });
  }

  const baseUrl = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;
  res.json({
    url: `${baseUrl}/api/auth/facebook/data-deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
};

export const facebookDataDeletionStatus = async (req: Request, res: Response) => {
  // Deletion is synchronous (anonymization happens in the callback), so any
  // issued confirmation code is by definition completed.
  res.json({ code: String(req.query.code || ''), status: 'completed' });
};

