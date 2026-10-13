const { Router } = require("express");
const controller = require("./doctor-availability.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const { slotSchema, createSchema, doctorIdParamSchema, idParamSchema } = controller.schemas;
const byId = validate(idParamSchema, { source: "params" });

// The availability procedures don't check roles themselves, so the backend does:
// any signed-in user can view a schedule; only SuperAdmin/Admin can change one.
const anyUser = requireTokenRole();
const manager = requireTokenRole("SuperAdmin", "Admin");

const router = Router();
router.get("/:doctorId", anyUser, validate(doctorIdParamSchema, { source: "params" }), controller.list);
router.post("/", manager, validate(createSchema), controller.create);
router.put("/:id", manager, byId, validate(slotSchema), controller.update);
router.delete("/:id", manager, byId, controller.remove);

module.exports = router;
