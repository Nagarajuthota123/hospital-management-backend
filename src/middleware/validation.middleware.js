const { failure } = require("../utils/response");

/**
 * Validates req.body (default) against a Joi schema. Usage:
 *   router.post("/", validate(schema), controller.create)
 * Pass { source: "query" | "params" } to validate other parts of the request.
 */
function validate(schema, { source = "body" } = {}) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      return failure(res, {
        message: "Validation failed.",
        status: 422,
        errors: error.details.map((d) => ({ field: d.path.join("."), message: d.message })),
      });
    }
    req[source] = value;
    return next();
  };
}

module.exports = { validate };
