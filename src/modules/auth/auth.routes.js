const { Router } = require("express");
const controller = require("./auth.controller");
const { validate } = require("../../middleware/validation.middleware");

const router = Router();
router.post("/superadmin-login", validate(controller.schemas.loginSchema), controller.superAdminLogin);
router.post("/admin-login", validate(controller.schemas.loginSchema), controller.adminLogin);

module.exports = router;
