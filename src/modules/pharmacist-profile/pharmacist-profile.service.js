const { runSp } = require("../../utils/sp");
const { ApiError } = require("../../middleware/error.middleware");
const { hhmm } = require("../doctor-availability/doctor-availability.service");

// The DB team's pharmacist procedures (parameters confirmed with `npm run check:db`):
//   sp_CreatePharmacistProfile     @UserId, @FirstName, @LastName, @Phone, @ShiftStartTime, @ShiftEndTime, @CreatedByUserId
//   sp_GetPharmacistProfile        @UserId
//   sp_UpdatePharmacistProfile     @UserId, @FirstName, @LastName, @Phone, @ShiftStartTime, @ShiftEndTime, @UpdatedByUserId
//   sp_SuperAdmin_GetPharmacists   @LoggedInUserId
//   sp_SuperAdmin_GetPharmacistById @LoggedInUserId, @PharmacistId
//   sp_SuperAdmin_UpdatePharmacist @LoggedInUserId, @PharmacistId, @FirstName, @LastName, @Phone, @Email
const SELF_PARAMS = "@FirstName = :firstName, @LastName = :lastName, @Phone = :phone, @ShiftStartTime = :shiftStartTime, @ShiftEndTime = :shiftEndTime";

const first = async (promise) => (await promise)[0];
// SQL TIME columns arrive as 1970-01-01 Dates; the API returns "HH:mm" like doctor availability.
const withShiftTimes = (row) => row && { ...row, ShiftStartTime: hhmm(row.ShiftStartTime), ShiftEndTime: hhmm(row.ShiftEndTime) };

// Only a SuperAdmin may create one (the procedure checks): userId = the pharmacist's account, createdByUserId = the SuperAdmin.
function create(createdByUserId, profile) {
  return first(runSp(
    `EXEC dbo.sp_CreatePharmacistProfile @UserId = :userId, ${SELF_PARAMS}, @CreatedByUserId = :createdByUserId`,
    { ...profile, createdByUserId }
  ));
}

async function get(userId) {
  const profile = await first(runSp("EXEC dbo.sp_GetPharmacistProfile @UserId = :userId", { userId }));
  if (!profile) throw new ApiError(404, "Pharmacist profile not found.");
  return withShiftTimes(profile);
}

// Also SuperAdmin-only (the procedure checks): userId = the pharmacist's account, updatedByUserId = the SuperAdmin.
function update(updatedByUserId, profile) {
  return first(runSp(
    `EXEC dbo.sp_UpdatePharmacistProfile @UserId = :userId, ${SELF_PARAMS}, @UpdatedByUserId = :updatedByUserId`,
    { ...profile, updatedByUserId }
  ));
}

async function list(loggedInUserId) {
  const rows = await runSp("EXEC dbo.sp_SuperAdmin_GetPharmacists @LoggedInUserId = :loggedInUserId", { loggedInUserId });
  return rows.map(withShiftTimes);
}

async function getById(loggedInUserId, pharmacistId) {
  const pharmacist = await first(runSp(
    "EXEC dbo.sp_SuperAdmin_GetPharmacistById @LoggedInUserId = :loggedInUserId, @PharmacistId = :pharmacistId",
    { loggedInUserId, pharmacistId }
  ));
  if (!pharmacist) throw new ApiError(404, "Pharmacist not found.");
  return withShiftTimes(pharmacist);
}

function updateById(loggedInUserId, pharmacistId, { firstName, lastName, phone, email }) {
  return first(runSp(
    `EXEC dbo.sp_SuperAdmin_UpdatePharmacist @LoggedInUserId = :loggedInUserId, @PharmacistId = :pharmacistId,
      @FirstName = :firstName, @LastName = :lastName, @Phone = :phone, @Email = :email`,
    { loggedInUserId, pharmacistId, firstName, lastName, phone, email }
  ));
}

module.exports = { create, get, update, list, getById, updateById };
