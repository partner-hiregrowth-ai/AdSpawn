import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { config } from '../config';

export interface AuthRequest extends Request {
  userId?: string;
  teamId?: string;
  profileId?: string;
  userAccessToken?: string;
  userRole?: string;
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
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; teamId?: string };
    req.userId = decoded.userId;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        team: {
          include: {
            owner: {
              select: { accessToken: true, accessTokenExpiresAt: true }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found', code: 'TOKEN_EXPIRED' });
    }

    req.teamId = user.teamId || decoded.teamId || undefined;
    req.userRole = user.role;

    const ownerToken = user.team?.owner?.accessToken;
    const ownerExpiry = user.team?.owner?.accessTokenExpiresAt;

    if (!ownerToken) {
      return res.status(401).json({ message: 'No Meta access token. Ask your team admin to connect Facebook.', code: 'TOKEN_EXPIRED' });
    }

    if (ownerExpiry) {
      const now = Date.now();
      const expiresAt = ownerExpiry.getTime();
      if (now >= expiresAt) {
        return res.status(401).json({ message: 'Facebook access token has expired. Ask your team admin to reconnect.', code: 'TOKEN_EXPIRED' });
      }
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (expiresAt - now < sevenDaysMs) {
        res.setHeader('X-Token-Expiry-Warning', ownerExpiry.toISOString());
      }
    }

    req.userAccessToken = ownerToken;

    const profileId = req.headers['x-profile-id'] as string | undefined;
    if (profileId) {
      const profile = await prisma.profile.findFirst({
        where: { id: profileId, teamId: req.teamId },
      });
      if (!profile) {
        return res.status(403).json({ message: 'Profile does not belong to your team' });
      }
      req.profileId = profileId;
    }

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// For routes whose data is scoped to a profile (drafts, wide creation).
// Without this, a missing X-Profile-Id header surfaces as a confusing 500
// deep inside a service instead of an actionable 400.
export const requireProfile = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.profileId) {
    return res.status(400).json({
      message: 'No profile selected. Choose a profile and try again.',
      code: 'PROFILE_REQUIRED',
    });
  }
  next();
};
