const { runSp } = require("../../utils/sp");

// The DB team's sp_*PatientProfile procedures, keyed by the signed-in patient's user id.
const PROFILE_PARAMS = `@FirstName = :firstName, @LastName = :lastName, @DateOfBirth = :dateOfBirth, @Gender = :gender,
  @Phone = :phone, @Email = :email, @Address = :address, @BloodGroup = :bloodGroup,
  @Height = :height, @Weight = :weight, @Allergies = :allergies`;

const first = async (promise) => (await promise)[0];

// A self-registering patient has no MRN yet, so it's derived from the user id: one profile per user, so it's unique.
// ponytail: fixed "PAT" + 6-digit format; change here if the hospital assigns MRNs another way.
const mrnFor = (userId) => `PAT${String(userId).padStart(6, "0")}`;

function create(userId, profile) {
  return first(runSp(
    `EXEC dbo.sp_CreatePatientProfile @UserId = :userId, @PatientMRN = :patientMrn, ${PROFILE_PARAMS}`,
    { ...profile, userId, patientMrn: mrnFor(userId) }
  ));
}

function get(userId) {
  return first(runSp("EXEC dbo.sp_GetPatientProfile @UserId = :userId", { userId }));
}

function update(userId, profile) {
  return first(runSp(`EXEC dbo.sp_UpdatePatientProfile @UserId = :userId, ${PROFILE_PARAMS}`, { ...profile, userId }));
}

module.exports = { create, get, update, mrnFor };
