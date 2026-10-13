const Joi = require("joi");
const service = require("./auth.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

const loginSchema = Joi.object({
  usernameOrEmail: Joi.string().trim().required(),
  password: Joi.string().min(6).required(),
});

// ponytail: kept as-is for the frontend - always HTTP 200; the real outcome is data.StatusCode (200/401/403/404/423).
const respond = (res, result) => success(res, { data: result, message: result.Message });

const superAdminLogin = asyncHandler(async (req, res) =>
  respond(res, await service.loginWithUsernameOrEmail(req.body.usernameOrEmail, req.body.password)));

const adminLogin = asyncHandler(async (req, res) =>
  respond(res, await service.loginAsAdmin(req.body.usernameOrEmail, req.body.password)));

module.exports = { superAdminLogin, adminLogin, schemas: { loginSchema } };
