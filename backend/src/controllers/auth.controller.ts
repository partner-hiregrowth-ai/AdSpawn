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
        console.log('[Auth] Successfully exchanged for long-lived token');
      } catch (exchangeError) {
        console.warn('[Auth] Could not exchange for long-lived token, using original:', exchangeError);
      }
    }

    // 3. Find or create user
    let user = await withRetry(() => prisma.user.findUnique({ where: { facebookId: id } }));

    if (!user) {
      user = await withRetry(() => prisma.user.create({
        data: { facebookId: id, name, email, accessToken: tokenToStore },
      }));
    } else {
      user = await withRetry(() => prisma.user.update({
        where: { id: user!.id },
        data: { accessToken: tokenToStore },
      }));
    }

    // 4. Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '60d' });

    res.json({ token, user });
  } catch (error) {
    console.error('FB Login Error:', error);
    res.status(401).json({ message: 'Invalid Facebook token' });
  }
};
