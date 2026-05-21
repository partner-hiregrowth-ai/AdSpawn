import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../prisma';

export const getTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.namingTemplate.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
};

export const createTemplate = async (req: AuthRequest, res: Response) => {
  const { name, pattern, type, isDefault } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ message: 'Template name is required' });
  }
  try {
    const existing = await prisma.namingTemplate.findFirst({
      where: { userId: req.userId, name: name.trim() },
    });
    if (existing) {
      return res.status(409).json({
        message: `A template named "${name.trim()}" already exists. Pick a different name.`,
      });
    }

    if (isDefault) {
      // Unset previous default for this type
      await prisma.namingTemplate.updateMany({
        where: { userId: req.userId, type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.namingTemplate.create({
      data: {
        userId: req.userId!,
        name: name.trim(),
        pattern,
        type,
        isDefault: !!isDefault,
      },
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create template' });
  }
};

export const updateTemplate = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { name, pattern, type, isDefault } = req.body;
  try {
    if (typeof name === 'string' && name.trim()) {
      const dup = await prisma.namingTemplate.findFirst({
        where: { userId: req.userId, name: name.trim(), NOT: { id } },
      });
      if (dup) {
        return res.status(409).json({
          message: `A template named "${name.trim()}" already exists. Pick a different name.`,
        });
      }
    }

    if (isDefault) {
      await prisma.namingTemplate.updateMany({
        where: { userId: req.userId, type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const template = await prisma.namingTemplate.update({
      where: { id, userId: req.userId },
      data: { name, pattern, type, isDefault },
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update template' });
  }
};

export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.namingTemplate.deleteMany({
      where: { id, userId: req.userId },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete template' });
  }
};
