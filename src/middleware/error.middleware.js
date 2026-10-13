const util = require("util");
const logger = require("../config/logger");
const { failure } = require("../utils/response");
const config = require("../config/env");

/** Custom error carrying an HTTP status code, thrown anywhere in services/controllers. */
class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function notFoundHandler(req, res) {
  return failure(res, { message: `Route not found: ${req.method} ${req.originalUrl}`, status: 404 });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === "SequelizeUniqueConstraintError") {
    return failure(res, {
      message: "A record with these details already exists.",
      status: 409,
      errors: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err.name === "SequelizeValidationError") {
    return failure(res, {
      message: "Validation failed.",
      status: 422,
      errors: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }
  if (err.name === "SequelizeForeignKeyConstraintError") {
    return failure(res, { message: "This action references a record that does not exist.", status: 409 });
  }

  const status = err.status || err.statusCode || 500;
  // ponytail: Sequelize wraps driver errors (e.g. mssql) and its own
  // .message is sometimes blank; the real reason is on .original/.parent.
  const dbMessage = err.original?.message || err.parent?.message;
  if (status >= 500) {
    // TEMP debugging: dump every enumerable + own property of the error,
    // since .message/.original/.parent have come back empty here.
    logger.error(util.inspect(err, { depth: 6, showHidden: false }));
  }

  // Only leak the raw DB error text outside production, to help debug locally.
  const exposedMessage = (config.env !== "production" && dbMessage) || err.message || "Internal server error";
  return failure(res, { message: exposedMessage, status, errors: err.errors });
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };
