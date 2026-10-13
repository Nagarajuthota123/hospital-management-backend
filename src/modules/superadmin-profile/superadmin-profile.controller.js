const Joi = require("joi");
const service = require("./superadmin-profile.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

// Lengths mirror the super_admin_profiles columns. The SPs take every parameter, so optional fields default to null.
const optional = (schema) => schema.allow(null).default(null);

const updateSchema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: optional(Joi.string().trim().max(100)),
  phone: Joi.string().trim().max(20).required(),
  email: optional(Joi.string().trim().lowercase().email().max(150)),
  designation: optional(Joi.string().trim().max(100)), // null keeps the current designation
});

// An explicit NULL would bypass the SP's default, so create sends it from here.
const createSchema = updateSchema.keys({
  designation: Joi.string().trim().max(100).default("System Administrator"),
});

// The profile always belongs to the signed-in SuperAdmin; the user id comes from the token, never the body.
const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user.id, req.body);
  return success(res, { data, message: data.Message, status: 201 });
});

const get = asyncHandler(async (req, res) => {
  const data = await service.get(req.user.id);
  return success(res, { data, message: data.Message });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.user.id, req.body);
  return success(res, { data, message: data.Message });
});

module.exports = { create, get, update, schemas: { createSchema, updateSchema } };
