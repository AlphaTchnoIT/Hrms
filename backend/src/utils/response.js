// Every API response follows the same shape: { success, message, data, meta }
export function sendSuccess(res, { data = null, message = 'Success', status = 200, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}
