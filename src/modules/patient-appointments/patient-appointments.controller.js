const Joi = require("joi");
const service = require("./patient-appointments.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

const bookSchema = Joi.object({
  doctorId: Joi.number().integer().positive().required(),
  // Local hospital time, no timezone: "2026-10-20T10:30". Sent to SQL as ISO 8601 with seconds.
  // The procedure itself rejects past times (by the database server's clock) and double bookings.
  appointmentDateTime: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/).required()
    .custom((value) => (value.length === 16 ? `${value}:00` : value))
    .messages({ "string.pattern.base": "appointmentDateTime must look like 2026-10-20T10:30." }),
  reason: Joi.string().trim().max(500).allow(null, "").default(null),
});
const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

// The patient is always the token's user; ids in the body are ignored.
const book = asyncHandler(async (req, res) => {
  const data = await service.book(req.user.id, req.body);
  return success(res, { data, message: data?.Message || "Appointment booked.", status: 201 });
});

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.user.id);
  return success(res, { data, message: `${data.length} appointment(s) found.` });
});

const cancel = asyncHandler(async (req, res) => {
  const data = await service.cancel(req.user.id, req.params.id);
  return success(res, { data, message: data?.Message || "Appointment cancelled." });
});

module.exports = { book, list, cancel, schemas: { bookSchema, idParamSchema } };
