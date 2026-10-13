const { Router } = require("express");
const controller = require("./patient-profile.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const router = Router();
router.use(requireTokenRole("Patient"));

router.post("/", validate(controller.schemas.profileSchema), controller.create);
router.get("/", controller.get);
router.put("/", validate(controller.schemas.profileSchema), controller.update);

module.exports = router;
