const Joi = require("joi");

// GET routes accept either an id ("8") or a username ("ravi01") in the same :key slot.
// ponytail: an all-digit username can't be looked up this way; add a /by-username/ route if that's ever allowed.
const keyParamSchema = Joi.object({
  key: Joi.alternatives(Joi.string().pattern(/^\d+$/), Joi.string().trim().min(3).max(50)).required(),
});

const byIdOrUsername = (key) => (/^\d+$/.test(key) ? { id: Number(key), username: null } : { id: null, username: key });

module.exports = { keyParamSchema, byIdOrUsername };
