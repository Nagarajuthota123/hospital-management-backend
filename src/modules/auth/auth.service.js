const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const { comparePassword } = require("../../utils/password");
const { signToken } = require("../../utils/jwt");

/**
 * Superadmin / username-or-email login.
 *
 * ponytail: the real HIMS `users`/`roles`/`user_roles` tables (owned by the
 * DB team, already backing their account-lookup SP) don't match the shape
 * the rest of this app's Sequelize models assume (no `name`/`department`/
 * `status` enum, roles are many-to-many via `user_roles`, not a `role_id`
 * FK). Remodeling every table for one endpoint isn't worth it, so this
 * queries the real columns directly instead of going through User/Role.
 */
async function loginByRole(usernameOrEmail, password, expectedRole) {
  const value = String(usernameOrEmail || "").trim();
  const rows = await sequelize.query(
    `SELECT u.id, u.username, u.email, u.password_hash AS passwordHash,
            u.is_active AS isActive, u.is_locked AS isLocked,
            r.role_name AS roleName
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = 1
     LEFT JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
     WHERE u.username = :value OR u.email = :value`,
    { replacements: { value }, type: QueryTypes.SELECT }
  );
  const user = rows[0];

  if (!user) return { StatusCode: 404, Username: null, Email: null, RoleName: null, Message: "Account not found." };
  if (user.isLocked) return { StatusCode: 423, Username: user.username, Email: user.email, RoleName: user.roleName, Message: "This account is locked." };
  if (!user.isActive) return { StatusCode: 403, Username: user.username, Email: user.email, RoleName: user.roleName, Message: "This account is inactive." };
  if (user.roleName !== expectedRole) {
    return { StatusCode: 403, Username: user.username, Email: user.email, RoleName: user.roleName, Message: `This account is not a ${expectedRole} account.` };
  }

  // password_hash must hold a bcrypt hash (generate with
  // src/utils/generatePasswordHash.js when inserting/resetting an account
  // by hand) — any row still holding a plain-text value will fail to log in
  // until it's regenerated.
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return { StatusCode: 401, Username: user.username, Email: user.email, RoleName: user.roleName, Message: "Invalid username/email or password." };

  const token = signToken({ sub: user.id, roleName: user.roleName });
  return {
    StatusCode: 200,
    Username: user.username,
    Email: user.email,
    RoleName: user.roleName,
    Message: `${user.roleName} account found.`,
    token,
  };
}

/** Superadmin module login — only authenticates accounts whose role is SuperAdmin. */
async function loginWithUsernameOrEmail(usernameOrEmail, password) {
  return loginByRole(usernameOrEmail, password, "SuperAdmin");
}

/** Admin module login — only authenticates accounts whose role is Admin. */
async function loginAsAdmin(usernameOrEmail, password) {
  return loginByRole(usernameOrEmail, password, "Admin");
}

module.exports = { loginWithUsernameOrEmail, loginAsAdmin };
