import { z } from 'zod';
import { idString } from './common';

export const itemSchema = z.object({
  id: idString,
  type: z.enum(['CAMPAIGN', 'ADSET', 'AD']),
}).passthrough();

export const bulkDuplicateSchema = z.object({
  items: z.array(itemSchema).min(1),
  adAccountId: idString,
}).passthrough();

export const convertObjectiveSchema = z.object({
  items: z.array(itemSchema).min(1),
  targetObjective: z.string().min(1),
  adAccountId: idString,
}).passthrough();
