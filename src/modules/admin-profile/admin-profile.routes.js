const { Router } = require("express");
const controller = require("./admin-profile.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const { keyParamSchema } = require("../../utils/lookup");

const validKey = validate(keyParamSchema, { source: "params" });
const adminOrSuper = requireTokenRole("Admin", "SuperAdmin");

const router = Router();

// sp_CreateAdminProfile only accepts Admin accounts; the view SPs also accept SuperAdmin.
router.post("/", requireTokenRole("Admin"), validate(controller.schemas.createSchema), controller.create);

// :key = numeric id or username
for (const [path, kind] of [["patients", "patient"], ["doctors", "doctor"]]) {
  router.get(`/${path}`, adminOrSuper, controller.listOf(kind));
  router.get(`/${path}/:key`, adminOrSuper, validKey, controller.getOneOf(kind));
}

module.exports = router;
