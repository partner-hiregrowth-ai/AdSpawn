import { Request, Response } from 'express';
import { prisma } from '../index';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const loginWithFacebook = async (req: Request, res: Response) => {
  const { accessToken } = req.body;

  try {
    // 1. Verify token with Facebook
    const fbResponse = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
    const { id, name, email } = fbResponse.data;

    // 2. Find or create user
    let user = await prisma.user.findUnique({
      where: { facebookId: id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          facebookId: id,
          name,
          email,
          accessToken,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { accessToken },
      });
    }

    // 3. Generate JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user });
  } catch (error) {
    console.error('FB Login Error:', error);
    res.status(401).json({ message: 'Invalid Facebook token' });
  }
};
