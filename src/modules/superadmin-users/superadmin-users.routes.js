const { Router } = require("express");
const controller = require("./superadmin-users.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const { listQuerySchema, idParamSchema, updateSchema, activeSchema, lockSchema, passwordSchema } = controller.schemas;
const byId = validate(idParamSchema, { source: "params" });

// SuperAdmin only. :id = users.id
const router = Router();
router.use(requireTokenRole("SuperAdmin"));

router.get("/", validate(listQuerySchema, { source: "query" }), controller.list);
router.get("/:id", byId, controller.getOne);
router.put("/:id", byId, validate(updateSchema), controller.update);
router.patch("/:id/status", byId, validate(activeSchema), controller.setActive);
router.patch("/:id/lock", byId, validate(lockSchema), controller.setLock);
router.patch("/:id/password", byId, validate(passwordSchema), controller.resetPassword);
router.delete("/:id", byId, controller.remove);

module.exports = router;
