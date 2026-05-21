import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  pattern: z.string().min(1, 'pattern is required'),
  type: z.string().min(1, 'type is required'),
  isDefault: z.boolean().optional(),
}).passthrough();

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  pattern: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
}).passthrough();
