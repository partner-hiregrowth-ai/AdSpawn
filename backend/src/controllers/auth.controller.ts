import { Request, Response } from 'express';
import { prisma, withRetry } from '../prisma';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const loginWithFacebook = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  try {
    // 1. Verify token with Facebook
    const fbResponse = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
    const { id, name, email } = fbResponse.data;

    // 2. Exchange short-lived token for a long-lived token (~60 days)
    // Short-lived tokens from the browser SDK expire in ~1-2 hours
    let tokenToStore = accessToken;
    let tokenExpiresAt: Date | undefined;
    const appId = process.env.FB_APP_ID;
    const appSecret = process.env.FB_APP_SECRET;
    if (appId && appSecret) {
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
      } catch (exchangeError) {
        console.warn('[Auth] Could not exchange for long-lived token, using original:', exchangeError);
      }
    }

    // 3. Find or create user
    let user = await withRetry(() => prisma.user.findUnique({ where: { facebookId: id } }));

    if (!user) {
      user = await withRetry(() => prisma.user.create({
        data: { facebookId: id, name, email, accessToken: tokenToStore, accessTokenExpiresAt: tokenExpiresAt },
      }));
    } else {
      user = await withRetry(() => prisma.user.update({
        where: { id: user!.id },
        data: { name, email, accessToken: tokenToStore, accessTokenExpiresAt: tokenExpiresAt },
      }));
    }

    // 4. Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '60d' });

    res.json({ token, user });
  } catch (error: any) {
    console.error('FB Login Error:', error);
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
