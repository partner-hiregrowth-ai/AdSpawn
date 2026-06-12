import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';
import { FacebookService } from '../services/facebook.service';
import axios from 'axios';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, facebookId: true, name: true, email: true, role: true, teamId: true, createdAt: true,
        team: { select: { name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user, teamName: user.team?.name || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const getTokenStatus = async (req: AuthRequest, res: Response) => {
  try {
    const accessToken = req.userAccessToken;
    if (!accessToken) {
      return res.json({ valid: false, message: 'No access token. Ask your team admin to connect Facebook.' });
    }

    // Token goes in params, never in the URL string — URLs end up in logs.
    const fbRes = await axios.get('https://graph.facebook.com/debug_token', {
      params: { input_token: accessToken, access_token: accessToken },
    });
    const data = fbRes.data?.data;
    res.json({
      valid: data?.is_valid ?? false,
      expiresAt: data?.expires_at ? new Date(data.expires_at * 1000).toISOString() : null,
      scopes: data?.scopes || [],
    });
  } catch (error: any) {
    res.json({ valid: false, message: 'Token validation failed' });
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  const profileId = req.profileId;
  const [draftRes, publishedRes, jobRes] = await Promise.allSettled([
    profileId ? prisma.draftCampaign.count({ where: { profileId, status: { not: 'PUBLISHED' } } }) : Promise.resolve(0),
    profileId ? prisma.draftCampaign.count({ where: { profileId, status: 'PUBLISHED' } }) : Promise.resolve(0),
    prisma.duplicateJob.count({ where: { userId: req.userId } }),
  ]);

  const pick = (r: PromiseSettledResult<number>): number | null =>
    r.status === 'fulfilled' ? r.value : null;

  if (draftRes.status === 'rejected') console.error('[getStats] draft count failed:', draftRes.reason);
  if (publishedRes.status === 'rejected') console.error('[getStats] published count failed:', publishedRes.reason);
  if (jobRes.status === 'rejected') console.error('[getStats] job count failed:', jobRes.reason);

  let accountCount: number | null = 0;
  try {
    const fbService = new FacebookService(req.userAccessToken!);
    const accounts = await fbService.getAdAccounts();
    accountCount = accounts.length;
  } catch {
    accountCount = null;
  }

  res.json({
    draftCount: pick(draftRes),
    publishedCount: pick(publishedRes),
    jobCount: pick(jobRes),
    accountCount,
  });
};

export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, teamId: true },
    });

    const profileIds = (await prisma.profile.findMany({
      where: { teamId: user?.teamId! },
      select: { id: true },
    })).map(p => p.id);

    if (user?.role === 'admin') {
      const memberCount = await prisma.user.count({ where: { teamId: user.teamId!, id: { not: req.userId } } });
      if (memberCount > 0) {
        return res.status(400).json({ error: 'Cannot delete admin account while team has other members. Remove all members first.' });
      }
      await prisma.$transaction([
        prisma.draftAd.deleteMany({ where: { profileId: { in: profileIds } } }),
        prisma.draftAdSet.deleteMany({ where: { profileId: { in: profileIds } } }),
        prisma.draftCampaign.deleteMany({ where: { profileId: { in: profileIds } } }),
        prisma.profile.deleteMany({ where: { teamId: user.teamId! } }),
        prisma.duplicateJob.deleteMany({ where: { userId: req.userId } }),
        prisma.namingTemplate.deleteMany({ where: { userId: req.userId } }),
        prisma.facebookAccount.deleteMany({ where: { userId: req.userId } }),
        prisma.team.deleteMany({ where: { ownerId: req.userId } }),
        prisma.user.delete({ where: { id: req.userId } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.duplicateJob.deleteMany({ where: { userId: req.userId } }),
        prisma.namingTemplate.deleteMany({ where: { userId: req.userId } }),
        prisma.facebookAccount.deleteMany({ where: { userId: req.userId } }),
        prisma.user.delete({ where: { id: req.userId } }),
      ]);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
};
