/**
 * Uniform API response envelope so every endpoint returns the same shape:
 *   { success, message, data, meta? }
 */
function success(res, { data = null, message = "OK", status = 200, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function failure(res, { message = "Something went wrong", status = 400, errors } = {}) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

module.exports = { success, failure };
