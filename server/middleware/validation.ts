import { z, ZodError } from 'zod';

/**
 * Middleware factory to validate request body against a Zod schema
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return async (req: any, res: any, next: any) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware factory to validate query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return async (req: any, res: any, next: any) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware factory to validate route parameters against a Zod schema
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return async (req: any, res: any, next: any) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid route parameters',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Sanitize string inputs to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Middleware to sanitize all string fields in request body
 */
export function sanitizeBody(req: any, res: any, next: any) {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Only sanitize if it's not base64 data or URLs
        if (!key.includes('Data') && !key.includes('Url') && !key.includes('thumbnail')) {
          req.body[key] = sanitizeString(req.body[key]);
        }
      }
    }
  }
  next();
}
