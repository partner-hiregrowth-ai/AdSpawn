import { z } from 'zod';
import { idString, nonEmptyIdArray } from './common';

export const duplicateToDraftSchema = z.object({
  campaignId: idString,
  count: z.number().int().min(1).max(50).optional(),
}).passthrough();

export const updateEntitySchema = z.record(z.string(), z.unknown());

export const getFormSchemaBodySchema = z.object({
  entityType: z.enum(['campaign', 'adSet', 'ad']),
  context: z.object({
    objective: z.string().optional(),
    buyingType: z.string().optional(),
    isCBO: z.boolean().optional(),
    destinationType: z.string().optional(),
  }).optional(),
}).passthrough();

export const importCampaignSchema = z.object({
  exported: z.object({
    version: z.number(),
    campaign: z.object({
      name: z.string().min(1),
      objective: z.string().optional(),
      adAccountId: z.string().min(1),
      data: z.unknown(),
      adSets: z.array(z.unknown()).optional(),
    }),
  }),
  adAccountId: z.string().optional(),
}).passthrough();

export const bulkPublishSchema = z.object({
  campaignIds: nonEmptyIdArray,
}).passthrough();

export const bulkDeleteSchema = z.object({
  campaignIds: nonEmptyIdArray,
}).passthrough();

export const bulkUpdateSchema = z.object({
  campaignIds: nonEmptyIdArray,
  updates: z.record(z.string(), z.any()),
}).passthrough();

export const bulkEditApplySchema = z.object({
  draftIds: nonEmptyIdArray,
  fieldUpdates: z.record(z.string(), z.any()).refine(
    v => Object.keys(v).length > 0,
    'fieldUpdates must be a non-empty object',
  ),
  level: z.enum(['campaign', 'adSet', 'ad']).optional(),
}).passthrough();

