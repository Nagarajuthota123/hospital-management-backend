const { Router } = require("express");
const controller = require("./pharmacist-profile.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const { createSchema, superAdminUpdateSchema, idParamSchema } = controller.schemas;
const byId = validate(idParamSchema, { source: "params" });

// /pharmacist-profile: the signed-in pharmacist reads their own profile (only a SuperAdmin can create/update it)
const selfRouter = Router();
selfRouter.use(requireTokenRole("Pharmacist"));
selfRouter.get("/", controller.get);

// /superadmin/pharmacists: SuperAdmin only. :id = PharmacistId
const superAdminRouter = Router();
superAdminRouter.use(requireTokenRole("SuperAdmin"));
superAdminRouter.get("/", controller.list);
superAdminRouter.post("/", validate(createSchema), controller.create);
superAdminRouter.put("/", validate(createSchema), controller.update); // body userId: name, phone, shift times
superAdminRouter.get("/:id", byId, controller.getById);
superAdminRouter.put("/:id", byId, validate(superAdminUpdateSchema), controller.updateById);

module.exports = { selfRouter, superAdminRouter };
