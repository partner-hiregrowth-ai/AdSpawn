import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

// Validates `req.body` against a Zod schema.
// On success, replaces `req.body` with the parsed (and possibly coerced) value.
// On failure, returns 400 with a concise field-level error list.
//
// Schemas should be permissive (`.passthrough()`) for objects whose extra keys
// are passed downstream to Meta — we only assert the shape we depend on.
export function validateBody(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error as ZodError).issues.slice(0, 10).map(i => ({
        path: i.path.join('.') || '(body)',
        message: i.message,
      }));
      return res.status(400).json({ error: 'Invalid request body', issues });
    }
    req.body = result.data;
    next();
  };
}
