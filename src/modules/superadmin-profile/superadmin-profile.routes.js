const { Router } = require("express");
const controller = require("./superadmin-profile.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const router = Router();
router.use(requireTokenRole("SuperAdmin"));

router.post("/", validate(controller.schemas.createSchema), controller.create);
router.get("/", controller.get);
router.put("/", validate(controller.schemas.updateSchema), controller.update);

module.exports = router;
