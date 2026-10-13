const Joi = require("joi");
const service = require("./patient-profile.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

// Required/optional and lengths mirror sp_CreatePatientProfile / sp_UpdatePatientProfile. Optional fields default to null.
const optional = (schema) => schema.allow(null).default(null);

const profileSchema = Joi.object({
  firstName: Joi.string().trim().max(100).required(),
  lastName: optional(Joi.string().trim().max(100)),
  phone: Joi.string().trim().max(20).required(),
  email: optional(Joi.string().trim().lowercase().email().max(150)),
  gender: Joi.string().valid("Male", "Female", "Other").required(),
  dateOfBirth: Joi.date().iso().max("now").raw().required(), // raw: pass "YYYY-MM-DD" through, not a Date object
  bloodGroup: optional(Joi.string().valid("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")),
  address: Joi.string().trim().max(500).required(),
  height: optional(Joi.number().positive().max(300)), // cm
  weight: optional(Joi.number().positive().max(500)), // kg
  allergies: optional(Joi.string().trim().max(1000)),
});

// A patient only ever touches their own profile; the user id comes from the token, never the body.
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

module.exports = { create, get, update, schemas: { profileSchema } };
