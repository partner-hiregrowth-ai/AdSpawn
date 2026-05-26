import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

// CSRF posture: JWTs are read from the `Authorization: Bearer …` header
// (not from a cookie), so a cross-site form/script cannot attach the
// credential automatically — traditional CSRF does not apply here.
// If a cookie-based session is ever introduced, add a CSRF token check
// (e.g. double-submit cookie or `csurf`) to every state-changing route.

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export interface AuthRequest extends Request {
  userId?: string;
  userAccessToken?: string;
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.log(`[Auth] Missing token for: ${req.method} ${req.url}`);
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.accessToken) {
      return res.status(401).json({ message: 'User not found or no access token', code: 'TOKEN_EXPIRED' });
    }

    if (user.accessTokenExpiresAt) {
      const now = Date.now();
      const expiresAt = user.accessTokenExpiresAt.getTime();
      if (now >= expiresAt) {
        return res.status(401).json({ message: 'Facebook access token has expired. Please log in again.', code: 'TOKEN_EXPIRED' });
      }
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (expiresAt - now < sevenDaysMs) {
        res.setHeader('X-Token-Expiry-Warning', user.accessTokenExpiresAt.toISOString());
      }
    }

    req.userAccessToken = user.accessToken;

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
