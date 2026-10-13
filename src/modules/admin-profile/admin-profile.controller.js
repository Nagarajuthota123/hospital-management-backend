const Joi = require("joi");
const service = require("./admin-profile.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");
const { byIdOrUsername } = require("../../utils/lookup");

// Lengths mirror the admin_profiles columns. Null designation/department -> the SP's defaults.
const optional = (schema) => schema.allow(null).default(null);

const createSchema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: optional(Joi.string().trim().max(100)),
  phone: Joi.string().trim().max(20).required(),
  email: optional(Joi.string().trim().lowercase().email().max(150)),
  designation: optional(Joi.string().trim().max(100)),
  department: optional(Joi.string().trim().max(100)),
});

// The profile always belongs to the signed-in Admin; the user id comes from the token, never the body.
const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user.id, req.body);
  return success(res, { data, message: data.Message, status: 201 });
});

const listOf = (kind) => asyncHandler(async (req, res) => success(res, { data: await service.list(kind, req.user.id) }));

const getOneOf = (kind) =>
  asyncHandler(async (req, res) => success(res, { data: await service.getOne(kind, req.user.id, byIdOrUsername(req.params.key)) }));

module.exports = { create, listOf, getOneOf, schemas: { createSchema } };
