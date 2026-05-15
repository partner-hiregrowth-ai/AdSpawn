import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

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
    req.userAccessToken = user.accessToken;

    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
