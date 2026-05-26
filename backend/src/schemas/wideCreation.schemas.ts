import { z } from 'zod';
import { idString } from './common';

const wideAdNodeSchema = z.object({
  fields: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const wideAdSetNodeSchema = z.object({
  fields: z.record(z.string(), z.unknown()).optional(),
  adCount: z.number().int().min(1).max(50).optional(),
  ads: z.array(wideAdNodeSchema).optional(),
}).passthrough();

const wideCampaignNodeSchema = z.object({
  fields: z.record(z.string(), z.unknown()).optional(),
  adSetCount: z.number().int().min(1).max(50).optional(),
  adSets: z.array(wideAdSetNodeSchema).optional(),
}).passthrough();

export const wideCreationTemplateSchema = z.object({
  adAccountId: idString,
  campaigns: z.array(wideCampaignNodeSchema).min(1).max(100),
  defaults: z.object({
    campaign: z.record(z.string(), z.unknown()).optional(),
    adSet: z.record(z.string(), z.unknown()).optional(),
    ad: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  namingPattern: z.object({
    campaign: z.string().optional(),
    adSet: z.string().optional(),
    ad: z.string().optional(),
  }).optional(),
}).passthrough();

export const wideCreationValidateSchema = wideCreationTemplateSchema;

export const wideCreationGenerateSchema = wideCreationTemplateSchema;

export const wideCreationBulkApplySchema = z.object({
  entityIds: z.array(idString).min(1),
  entityType: z.enum(['campaign', 'adSet', 'ad']),
  fieldUpdates: z.record(z.string(), z.unknown()).refine(
    v => Object.keys(v).length > 0,
    'fieldUpdates must be non-empty',
  ),
  cascadeToChildren: z.boolean().optional(),
}).passthrough();

export const wideCreationTreeSchema = z.object({
  templateId: idString.optional(),
  campaignIds: z.array(idString).optional(),
}).passthrough();
