const Joi = require("joi");
const service = require("./superadmin-appointments.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");
const patientAppointments = require("../patient-appointments/patient-appointments.controller");

// Same "2026-10-20T10:30" local-time rule the patient booking uses.
const dateTime = patientAppointments.schemas.bookSchema.extract("appointmentDateTime");
const id = Joi.number().integer().positive();
const date = Joi.date().iso().raw(); // "YYYY-MM-DD", passed through as text
// ponytail: status is free text; the procedure decides which values are valid. Add Joi.valid(...) once the list is fixed.
const status = Joi.string().trim().max(20);

const listQuerySchema = Joi.object({
  fromDate: date,
  toDate: date.when("fromDate", { is: Joi.exist(), then: Joi.date().min(Joi.ref("fromDate")) }),
  doctorId: id.default(null),
  patientId: id.default(null),
  status: status.default(null),
}).messages({ "date.min": "toDate can't be before fromDate." });
const idParamSchema = Joi.object({ id: id.required() });
const bookSchema = Joi.object({
  doctorId: id.required(),
  patientId: id.required(),
  appointmentDateTime: dateTime.required(),
  reason: Joi.string().trim().max(500).allow(null, "").default(null),
});
const rescheduleSchema = Joi.object({ newAppointmentDateTime: dateTime.required() });
const statusSchema = Joi.object({ status: status.required() });

const reply = (res, data, fallback, status = 200) => success(res, { data, message: data?.Message || fallback, status });

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.user.id, req.query);
  return success(res, { data, message: `${data.length} appointment(s) found.` });
});

const getOne = asyncHandler(async (req, res) => reply(res, await service.getOne(req.user.id, req.params.id), "OK"));

const book = asyncHandler(async (req, res) => reply(res, await service.book(req.user.id, req.body), "Appointment booked.", 201));

const reschedule = asyncHandler(async (req, res) =>
  reply(res, await service.reschedule(req.user.id, req.params.id, req.body.newAppointmentDateTime), "Appointment rescheduled."));

const setStatus = asyncHandler(async (req, res) =>
  reply(res, await service.setStatus(req.user.id, req.params.id, req.body.status), "Appointment status updated."));

module.exports = { list, getOne, book, reschedule, setStatus, schemas: { listQuerySchema, idParamSchema, bookSchema, rescheduleSchema, statusSchema } };
