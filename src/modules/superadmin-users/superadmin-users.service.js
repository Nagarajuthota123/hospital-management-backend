const { runSp } = require("../../utils/sp");
const { hashPassword } = require("../../utils/password");
const { ApiError } = require("../../middleware/error.middleware");

// The DB team's sp_SuperAdmin_* user procedures. @LoggedInUserId is the signed-in SuperAdmin;
// the procedures do their own role check too.
const first = async (promise) => (await promise)[0];

// @RoleName / @IsActive are optional filters: null = all.
function list(loggedInUserId, { roleName, isActive }) {
  return runSp(
    "EXEC dbo.sp_SuperAdmin_GetUsers @LoggedInUserId = :loggedInUserId, @RoleName = :roleName, @IsActive = :isActive",
    { loggedInUserId, roleName, isActive }
  );
}

async function getOne(loggedInUserId, userId) {
  const user = await first(runSp("EXEC dbo.sp_SuperAdmin_GetUserById @LoggedInUserId = :loggedInUserId, @UserId = :userId", { loggedInUserId, userId }));
  if (!user) throw new ApiError(404, "User not found.");
  return user;
}

function update(loggedInUserId, userId, { username, email }) {
  return first(runSp(
    "EXEC dbo.sp_SuperAdmin_UpdateUser @LoggedInUserId = :loggedInUserId, @UserId = :userId, @Username = :username, @Email = :email",
    { loggedInUserId, userId, username, email }
  ));
}

function setActive(loggedInUserId, userId, isActive) {
  return first(runSp(
    "EXEC dbo.sp_SuperAdmin_SetUserActive @LoggedInUserId = :loggedInUserId, @UserId = :userId, @IsActive = :isActive",
    { loggedInUserId, userId, isActive }
  ));
}

function setLock(loggedInUserId, userId, isLocked) {
  return first(runSp(
    "EXEC dbo.sp_SuperAdmin_SetUserLock @LoggedInUserId = :loggedInUserId, @UserId = :userId, @IsLocked = :isLocked",
    { loggedInUserId, userId, isLocked }
  ));
}

// Only the bcrypt hash reaches the database, never the plain password.
async function resetPassword(loggedInUserId, userId, newPassword) {
  return first(runSp(
    "EXEC dbo.sp_SuperAdmin_ResetPassword @LoggedInUserId = :loggedInUserId, @UserId = :userId, @PasswordHash = :passwordHash",
    { loggedInUserId, userId, passwordHash: await hashPassword(newPassword) }
  ));
}

function remove(loggedInUserId, userId) {
  return first(runSp("EXEC dbo.sp_SuperAdmin_DeleteUser @LoggedInUserId = :loggedInUserId, @UserId = :userId", { loggedInUserId, userId }));
}

module.exports = { list, getOne, update, setActive, setLock, resetPassword, remove };
