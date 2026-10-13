const { runSp } = require("../../utils/sp");
const { ApiError } = require("../../middleware/error.middleware");

// The SQL team's sp_Doctor_* procedures are used exactly as they are (keyed by @DoctorId).
const PROFILE_PARAMS = `@FirstName = :firstName, @LastName = :lastName, @Gender = :gender, @Phone = :phone,
  @Email = :email, @QualificationDegree = :qualificationDegree, @Specialization = :specialization,
  @YearsOfExperience = :yearsOfExperience`;

const pick = (row, ...keys) => keys.map((k) => row?.[k]).find((v) => v !== undefined && v !== null);

async function create(loggedInUserId, profile) {
  const [row] = await runSp(
    `EXEC dbo.sp_Doctor_CreateProfile @LoggedInUserId = :loggedInUserId, @UserId = :userId, ${PROFILE_PARAMS}`,
    { ...profile, loggedInUserId }
  );
  return row;
}

function list(loggedInUserId) {
  return runSp("EXEC dbo.sp_Doctor_GetAllDoctors @LoggedInUserId = :loggedInUserId", { loggedInUserId });
}

// :key is a DoctorId or a username. There is no SP that looks a doctor up by username,
// so a username is matched against the active-doctor list.
// ponytail: O(n) scan of active doctors; ask the SQL team for an @Username param if the list grows large.
async function resolveDoctorId(loggedInUserId, { id, username }) {
  if (id) return id;
  const doctors = await list(loggedInUserId);
  const match = doctors.find((d) => String(pick(d, "Username", "UserName", "username") || "").toLowerCase() === username.toLowerCase());
  if (!match) throw new ApiError(404, "Doctor not found.");
  return pick(match, "DoctorId", "Id", "id");
}

async function getOne(loggedInUserId, lookup) {
  const doctorId = await resolveDoctorId(loggedInUserId, lookup);
  const [profile] = await runSp(
    "EXEC dbo.sp_Doctor_GetProfile @LoggedInUserId = :loggedInUserId, @DoctorId = :doctorId",
    { loggedInUserId, doctorId }
  );
  if (!profile) throw new ApiError(404, "Doctor not found.");
  return profile;
}

async function update(loggedInUserId, lookup, profile) {
  const doctorId = await resolveDoctorId(loggedInUserId, lookup);
  const [row] = await runSp(
    `EXEC dbo.sp_Doctor_UpdateProfile @LoggedInUserId = :loggedInUserId, @DoctorId = :doctorId, ${PROFILE_PARAMS}`,
    { ...profile, loggedInUserId, doctorId }
  );
  return row;
}

async function remove(loggedInUserId, lookup) {
  const doctorId = await resolveDoctorId(loggedInUserId, lookup);
  const [row] = await runSp(
    "EXEC dbo.sp_Doctor_DeleteProfile @LoggedInUserId = :loggedInUserId, @DoctorId = :doctorId",
    { loggedInUserId, doctorId }
  );
  return row;
}

module.exports = { create, list, getOne, update, remove };
