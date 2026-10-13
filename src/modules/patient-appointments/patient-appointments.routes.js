const { Router } = require("express");
const controller = require("./patient-appointments.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const { bookSchema, idParamSchema } = controller.schemas;
const router = Router();
router.use(requireTokenRole("Patient"));

router.post("/", validate(bookSchema), controller.book);
router.get("/", controller.list);
router.patch("/:id/cancel", validate(idParamSchema, { source: "params" }), controller.cancel);

module.exports = router;
