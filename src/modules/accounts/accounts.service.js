const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../config/database");
const { hashPassword, comparePassword } = require("../../utils/password");
const { signToken } = require("../../utils/jwt");
const { runSp } = require("../../utils/sp");
const { ApiError } = require("../../middleware/error.middleware");

/**
 * Account stored procedures per role. Adding a role (e.g. Nurse) is one entry here + one line in routes/index.js.
 * createdBy: token roles allowed to create the account; null = public self-registration.
 * No loginSp = no /login route (Admin logs in via /auth/admin-login).
 */
const ROLES = {
  Patient: { createSp: "sp_CreatePatientAccount", loginSp: "sp_GetPatientForLogin", createdBy: null },
  Doctor: { createSp: "sp_CreateDoctorAccount", loginSp: "sp_GetDoctorForLogin", createdBy: ["SuperAdmin"] },
  Pharmacist: { createSp: "sp_CreatePharmacistAccount", loginSp: "sp_GetPharmacistForLogin", createdBy: ["SuperAdmin"] },
  Admin: { createSp: "sp_CreateAdminAccount", createdBy: ["SuperAdmin"] },
};

// Reads a column regardless of naming style or case (PasswordHash / password_hash / PASSWORDHASH, UserId / UserID).
const pick = (row, ...keys) => {
  const byLower = new Map(Object.entries(row || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return keys.map((k) => byLower.get(k.toLowerCase())).find((v) => v !== undefined && v !== null);
};
const HASH_KEYS = ["PasswordHash", "password_hash", "passwordHash"];

function withoutHash(row) {
  const safe = { ...row };
  HASH_KEYS.forEach((k) => delete safe[k]);
  return safe;
}

async function createAccount(role, { username, email, password }, createdByUserId) {
  const { createSp, createdBy } = ROLES[role];
  const createdByParam = createdBy ? ", @CreatedByUserId = :createdByUserId" : "";
  const [row = {}] = await runSp(
    `EXEC dbo.${createSp} @Username = :username, @Email = :email, @PasswordHash = :passwordHash${createdByParam}`,
    { username, email: email.toLowerCase(), passwordHash: await hashPassword(password), createdByUserId }
  );
  return withoutHash(row);
}

// The sp_Get*ForLogin procedures return Username but no id; users.username is the account's unique key.
async function userIdByUsername(username) {
  if (!username) return undefined;
  const [row] = await sequelize.query("SELECT id FROM dbo.users WHERE username = :username", {
    replacements: { username }, type: QueryTypes.SELECT,
  });
  return row?.id;
}

async function login(role, usernameOrEmail, password) {
  const [user] = await runSp(`EXEC dbo.${ROLES[role].loginSp} @UsernameOrEmail = :usernameOrEmail`, { usernameOrEmail });
  if (!user) throw new ApiError(401, "Invalid username/email or password.");

  const isLocked = pick(user, "IsLocked", "is_locked", "isLocked");
  if (isLocked === true || isLocked === 1) throw new ApiError(423, "This account is locked.");
  const isActive = pick(user, "IsActive", "is_active", "isActive");
  if (isActive === false || isActive === 0) throw new ApiError(403, "This account is inactive.");

  // Same message for "no user" and "wrong password" so accounts can't be enumerated.
  const hash = pick(user, ...HASH_KEYS);
  if (!hash || !(await comparePassword(password, hash))) throw new ApiError(401, "Invalid username/email or password.");

  const userId = pick(user, "UserId", "user_id", "Id") ?? (await userIdByUsername(pick(user, "Username", "user_name")));
  // Without an id every later request would run with an empty @UserId, so fail here, loudly.
  if (userId === undefined) {
    throw new ApiError(500, `${ROLES[role].loginSp} returned no user id column (got: ${Object.keys(user).join(", ")}).`);
  }
  return { token: signToken({ sub: userId, roleName: role }), user: withoutHash(user) };
}

module.exports = { ROLES, createAccount, login };
