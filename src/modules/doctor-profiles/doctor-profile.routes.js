const { Router } = require("express");
const controller = require("./doctor-profile.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");
const { keyParamSchema } = require("../../utils/lookup");

const { createSchema, updateSchema } = controller.schemas;
const validKey = validate(keyParamSchema, { source: "params" });

// Every doctor profile SP is SuperAdmin-only. :key = DoctorId or username.
const router = Router();
router.use(requireTokenRole("SuperAdmin"));

router.get("/", controller.list);
router.get("/:key", validKey, controller.getOne);
router.post("/", validate(createSchema), controller.create);
router.put("/:key", validKey, validate(updateSchema), controller.update);
router.delete("/:key", validKey, controller.remove);

module.exports = router;
