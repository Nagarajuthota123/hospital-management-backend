const { Router } = require("express");
const controller = require("./superadmin-appointments.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const { listQuerySchema, idParamSchema, bookSchema, rescheduleSchema, statusSchema } = controller.schemas;
const byId = validate(idParamSchema, { source: "params" });

// SuperAdmin only. :id = AppointmentId
const router = Router();
router.use(requireTokenRole("SuperAdmin"));

router.get("/", validate(listQuerySchema, { source: "query" }), controller.list);
router.get("/:id", byId, controller.getOne);
router.post("/", validate(bookSchema), controller.book);
router.patch("/:id/reschedule", byId, validate(rescheduleSchema), controller.reschedule);
router.patch("/:id/status", byId, validate(statusSchema), controller.setStatus);

module.exports = router;
