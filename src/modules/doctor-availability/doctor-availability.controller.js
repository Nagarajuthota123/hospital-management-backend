const Joi = require("joi");
const service = require("./doctor-availability.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).messages({ "string.pattern.base": "{#label} must be HH:mm (24-hour)." });

// The procedures check end > start, overlaps and a non-negative fee; this catches bad input before the database.
const slotSchema = Joi.object({
  dayOfWeek: Joi.string().valid(...service.DAY_ORDER).required(),
  startTime: time.required(),
  endTime: time.required(),
  slotMinutes: Joi.number().integer().min(5).max(240).required(),
  consultationFee: Joi.number().min(0).precision(2).required(),
});
const createSchema = slotSchema.keys({ doctorId: Joi.number().integer().positive().required() });
const doctorIdParamSchema = Joi.object({ doctorId: Joi.number().integer().positive().required() });
const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.params.doctorId);
  return success(res, { data, message: `${data.length} availability slot(s) found.` });
});

const create = asyncHandler(async (req, res) => {
  const data = await service.create(req.user.id, req.body);
  return success(res, { data, message: data?.Message || "Availability created.", status: 201 });
});

const update = asyncHandler(async (req, res) => {
  const data = await service.update(req.user.id, req.params.id, req.body);
  return success(res, { data, message: data?.Message || "Availability updated." });
});

const remove = asyncHandler(async (req, res) => {
  const data = await service.remove(req.user.id, req.params.id);
  return success(res, { data, message: data?.Message || "Availability deleted." });
});

module.exports = { list, create, update, remove, schemas: { slotSchema, createSchema, doctorIdParamSchema, idParamSchema } };
