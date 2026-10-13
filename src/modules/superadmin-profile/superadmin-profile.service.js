const { runSp } = require("../../utils/sp");

const PROFILE_PARAMS = "@FirstName = :firstName, @LastName = :lastName, @Phone = :phone, @Email = :email, @Designation = :designation";

const first = async (promise) => (await promise)[0];

function create(userId, profile) {
  return first(runSp(`EXEC dbo.sp_CreateSuperAdminProfile @UserId = :userId, ${PROFILE_PARAMS}`, { ...profile, userId }));
}

function get(userId) {
  return first(runSp("EXEC dbo.sp_GetSuperAdminProfile @UserId = :userId", { userId }));
}

function update(userId, profile) {
  return first(runSp(`EXEC dbo.sp_UpdateSuperAdminProfile @UserId = :userId, ${PROFILE_PARAMS}`, { ...profile, userId }));
}

module.exports = { create, get, update };
