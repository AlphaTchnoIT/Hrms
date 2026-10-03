// A small error class so controllers can throw errors with an HTTP status code
export class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors; // optional { field: message } map for form errors
  }

  // 422 with field level errors. The first error becomes the main message.
  static validation(errors, message) {
    return new ApiError(422, message || Object.values(errors)[0] || 'Please check the form', errors);
  }

  // Shortcut for a single field error thrown from a controller
  static field(field, message) {
    return ApiError.validation({ [field]: message });
  }

  static badRequest(message = 'Bad request') {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Not authorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
}
