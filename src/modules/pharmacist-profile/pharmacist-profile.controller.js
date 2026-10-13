const Joi = require("joi");
const service = require("./pharmacist-profile.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

// Optional fields default to null because the procedures take every parameter.
const optional = (schema) => schema.allow(null).default(null);

// "HH:mm" 24-hour, same rule as doctor availability.
const time = require("../doctor-availability/doctor-availability.controller").schemas.slotSchema.extract("startTime").optional();
const name = { firstName: Joi.string().trim().max(75).required(), lastName: optional(Joi.string().trim().max(75)) }; // VARCHAR(75) in the procedures
const phone = Joi.string().trim().max(20).required();

// Pharmacist's own profile: sp_Create/UpdatePharmacistProfile take no email.
const profileSchema = Joi.object({
  ...name,
  phone,
  // Both procedures require shift times. "HH:mm" strings compare correctly as text.
  shiftStartTime: time.required(),
  shiftEndTime: time.required().custom((end, helpers) => {
    const start = helpers.state.ancestors[0].shiftStartTime;
    return start && end <= start ? helpers.message("shiftEndTime must be after shiftStartTime.") : end;
  }),
});

// SuperAdmin create / profile update: same fields plus the pharmacist's account id (from /pharmacist-auth/register).
const createSchema = profileSchema.keys({ userId: Joi.number().integer().positive().required() });

// SuperAdmin update: sp_SuperAdmin_UpdatePharmacist takes no shift times.
const superAdminUpdateSchema = Joi.object({
  ...name,
  phone,
  email: optional(Joi.string().trim().lowercase().email().max(150)),
});
const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

// SuperAdmin creates/updates the profile for a pharmacist account; Created/UpdatedByUserId is the SuperAdmin's token id.
const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user.id, req.body);
  return success(res, { data, message: data?.Message || "Pharmacist profile created.", status: 201 });
});

// Pharmacist: own profile only; the user id comes from the token, never the body.
const get = asyncHandler(async (req, res) => {
  const data = await service.get(req.user.id);
  return success(res, { data, message: data.Message || "OK" });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.user.id, req.body);
  return success(res, { data, message: data?.Message || "Pharmacist profile updated." });
});

// SuperAdmin: :id = PharmacistId; LoggedInUserId is the SuperAdmin's token id.
const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.user.id);
  return success(res, { data, message: `${data.length} pharmacist(s) found.` });
});

const getById = asyncHandler(async (req, res) => {
  const data = await service.getById(req.user.id, req.params.id);
  return success(res, { data, message: data.Message || "OK" });
});

const updateById = asyncHandler(async (req, res) => {
  const data = await service.updateById(req.user.id, req.params.id, req.body);
  return success(res, { data, message: data?.Message || "Pharmacist updated." });
});

module.exports = { create, get, update, list, getById, updateById, schemas: { profileSchema, createSchema, superAdminUpdateSchema, idParamSchema } };
