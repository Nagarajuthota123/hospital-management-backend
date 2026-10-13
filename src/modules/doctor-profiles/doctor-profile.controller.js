const Joi = require("joi");
const service = require("./doctor-profile.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");
const { byIdOrUsername } = require("../../utils/lookup");

// Lengths mirror the doctor SPs' parameters. Optional fields default to null because the SPs take every parameter.
const optional = (schema) => schema.allow(null).default(null);

const profileSchema = Joi.object({
  firstName: Joi.string().trim().max(50).required(),
  lastName: optional(Joi.string().trim().max(50)),
  gender: optional(Joi.string().trim().max(20)),
  phone: Joi.string().trim().max(20).required(),
  email: optional(Joi.string().trim().lowercase().email().max(150)),
  qualificationDegree: optional(Joi.string().trim().max(255)),
  specialization: optional(Joi.string().trim().max(100)),
  yearsOfExperience: optional(Joi.number().integer().min(0)),
});

// userId links the profile to an existing doctor account (from /doctor-auth/register).
const createSchema = profileSchema.keys({
  userId: optional(Joi.number().integer().positive()),
});

// LoggedInUserId comes from the signed-in SuperAdmin's token, never from the body.
const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user.id, req.body);
  return success(res, { data, message: data.Message, status: 201 });
});

const list = asyncHandler(async (req, res) => success(res, { data: await service.list(req.user.id) }));

const getOne = asyncHandler(async (req, res) =>
  success(res, { data: await service.getOne(req.user.id, byIdOrUsername(req.params.key)) }));

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.user.id, byIdOrUsername(req.params.key), req.body);
  return success(res, { data, message: data.Message });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(req.user.id, byIdOrUsername(req.params.key));
  return success(res, { data, message: data.Message });
});

module.exports = { create, list, getOne, update, remove, schemas: { createSchema, updateSchema: profileSchema } };
