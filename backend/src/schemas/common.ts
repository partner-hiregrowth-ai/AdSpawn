import { z } from 'zod';

// IDs from Meta are numeric strings; CUIDs from Prisma are alphanumeric.
// Keep this permissive — we just want to reject empty strings and non-strings.
export const idString = z.string().min(1, 'must be a non-empty string');

export const nonEmptyIdArray = z.array(idString).min(1, 'must be a non-empty array');
