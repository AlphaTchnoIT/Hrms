import { ApiError } from '../utils/ApiError.js';

// Turns zod issues into { "field.path": "message" } (first message per field)
export function formatZodErrors(zodError) {
  const errors = {};
  zodError.issues.forEach((issue) => {
    const key = issue.path.join('.') || 'form';
    if (!errors[key]) errors[key] = issue.message;
  });
  return errors;
}

/*
 * Validates req.body (default) with a zod schema.
 * On success req.body is replaced with the cleaned data (unknown fields removed, values trimmed/converted).
 * On failure responds 422 with { message, errors: { field: message } }.
 *
 * Usage: router.post('/', validate(createEmployeeSchema), createEmployee)
 */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      throw ApiError.validation(errors);
    }
    if (source === 'body') req.body = result.data;
    else req.validated = { ...(req.validated || {}), [source]: result.data };
    next();
  };
}
