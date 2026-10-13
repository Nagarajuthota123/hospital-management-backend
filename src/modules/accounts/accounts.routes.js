const { Router } = require("express");
const { forRole, schemas } = require("./accounts.controller");
const { ROLES } = require("./accounts.service");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

/**
 * Router for one role:
 *   POST /register -> public for Patient; otherwise a token of a role in ROLES[role].createdBy
 *   POST /login    -> public; returns a JWT (only if the role has a loginSp)
 */
function buildAccountRouter(role) {
  const controller = forRole(role);
  const { createdBy, loginSp } = ROLES[role];
  const router = Router();

  const guard = createdBy ? [requireTokenRole(...createdBy)] : [];
  router.post("/register", ...guard, validate(schemas.createAccountSchema), controller.createAccount);
  if (loginSp) router.post("/login", validate(schemas.loginSchema), controller.login);

  return router;
}

module.exports = { buildAccountRouter };
