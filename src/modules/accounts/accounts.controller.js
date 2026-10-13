const Joi = require("joi");
const service = require("./accounts.service");
const { success } = require("../../utils/response");
const { asyncHandler } = require("../../middleware/error.middleware");

const createAccountSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  email: Joi.string().trim().email().max(150).required(),
  password: Joi.string().min(6).max(128).required(),
});

const loginSchema = Joi.object({
  usernameOrEmail: Joi.string().trim().max(150).required(),
  password: Joi.string().min(6).max(128).required(),
});

/** Handlers for one role ("Patient" | "Doctor" | "Pharmacist" | "Admin"). */
function forRole(role) {
  const createAccount = asyncHandler(async (req, res) => {
    // CreatedByUserId comes from the signed-in user's token, never from the body.
    const data = await service.createAccount(role, req.body, req.user?.id);
    return success(res, { data, message: data.Message || `${role} account created.`, status: 201 });
  });

  const login = asyncHandler(async (req, res) => {
    const data = await service.login(role, req.body.usernameOrEmail, req.body.password);
    return success(res, { data, message: "Signed in successfully." });
  });

  return { createAccount, login };
}

module.exports = { forRole, schemas: { createAccountSchema, loginSchema } };
