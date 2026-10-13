const Joi = require("joi");
const service = require("./superadmin-users.service");
const { success } = require("../../utils/response");
const { asyncHandler, ApiError } = require("../../middleware/error.middleware");

// Rules mirror account registration (accounts.controller.js).
const listQuerySchema = Joi.object({
  roleName: Joi.string().valid("SuperAdmin", "Admin", "Doctor", "Pharmacist", "Patient").default(null),
  isActive: Joi.boolean().default(null), // ?isActive=true / false
});
const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });
const updateSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().trim().lowercase().email().max(150).required(),
});
const activeSchema = Joi.object({ isActive: Joi.boolean().required() });
const lockSchema = Joi.object({ isLocked: Joi.boolean().required() });
const passwordSchema = Joi.object({ newPassword: Joi.string().min(6).max(128).required() });

// A SuperAdmin can't deactivate, lock or delete their own account and lose access to the system.
const notSelf = (req) => {
  if (Number(req.params.id) === Number(req.user.id)) throw new ApiError(400, "You can't do this to your own account.");
};

const reply = (res, data, fallback) => success(res, { data, message: data?.Message || fallback });

const list = asyncHandler(async (req, res) => {
  const data = await service.list(req.user.id, req.query);
  return success(res, { data, message: `${data.length} user(s) found.` });
});

const getOne = asyncHandler(async (req, res) => {
  const data = await service.getOne(req.user.id, req.params.id);
  return success(res, { data, message: data.Message || "OK" });
});

const update = asyncHandler(async (req, res) =>
  reply(res, await service.update(req.user.id, req.params.id, req.body), "User updated."));

const setActive = asyncHandler(async (req, res) => {
  if (!req.body.isActive) notSelf(req);
  return reply(res, await service.setActive(req.user.id, req.params.id, req.body.isActive), req.body.isActive ? "User activated." : "User deactivated.");
});

const setLock = asyncHandler(async (req, res) => {
  if (req.body.isLocked) notSelf(req);
  return reply(res, await service.setLock(req.user.id, req.params.id, req.body.isLocked), req.body.isLocked ? "User locked." : "User unlocked.");
});

const resetPassword = asyncHandler(async (req, res) =>
  reply(res, await service.resetPassword(req.user.id, req.params.id, req.body.newPassword), "Password reset."));

const remove = asyncHandler(async (req, res) => {
  notSelf(req);
  return reply(res, await service.remove(req.user.id, req.params.id), "User deleted.");
});

module.exports = { list, getOne, update, setActive, setLock, resetPassword, remove, schemas: { listQuerySchema, idParamSchema, updateSchema, activeSchema, lockSchema, passwordSchema } };
