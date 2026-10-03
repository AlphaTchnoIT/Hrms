import { env } from '../config/env.js';

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Converts any thrown error into a clean JSON response
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let errors = err.errors && !err.name?.includes('Validation') ? err.errors : undefined;

  // Mongoose validation error -> field errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    errors = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]));
    message = Object.values(errors)[0];
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid request body';
  }

  // Invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Duplicate unique key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `A record with this ${field || 'value'} already exists`;
    if (field) errors = { [field]: `This ${field} is already in use` };
  }

  if (statusCode === 500) {
    console.error(err);
    if (env.nodeEnv === 'production') message = 'Something went wrong, please try again';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    ...(env.nodeEnv === 'development' && statusCode === 500 ? { stack: err.stack } : {}),
  });
}
