const { runSp } = require("../../utils/sp");

// The DB team's doctor availability procedures (dbo.DoctorAvailability).
const PARAMS = "@DayOfWeek = :dayOfWeek, @StartTime = :startTime, @EndTime = :endTime, @SlotMinutes = :slotMinutes, @ConsultationFee = :consultationFee";
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// SQL TIME arrives as a Date on 1970-01-01 (UTC); the API returns plain "HH:mm".
const hhmm = (t) => (t instanceof Date ? t.toISOString().slice(11, 16) : t);

const first = async (promise) => (await promise)[0];

// The procedure orders by day name alphabetically; sort Monday..Sunday, then by start time.
async function list(doctorId) {
  const rows = await runSp("EXEC dbo.sp_GetDoctorAvailability @DoctorId = :doctorId", { doctorId });
  return rows
    .map((r) => ({ ...r, StartTime: hhmm(r.StartTime), EndTime: hhmm(r.EndTime) }))
    .sort((a, b) => DAY_ORDER.indexOf(a.DayOfWeek) - DAY_ORDER.indexOf(b.DayOfWeek) || a.StartTime.localeCompare(b.StartTime));
}

function create(loggedInUserId, slot) {
  return first(runSp(
    `EXEC dbo.sp_CreateDoctorAvailability @LoggedInUserId = :loggedInUserId, @DoctorId = :doctorId, ${PARAMS}`,
    { ...slot, loggedInUserId }
  ));
}

function update(loggedInUserId, availabilityId, slot) {
  return first(runSp(
    `EXEC dbo.sp_UpdateDoctorAvailability @LoggedInUserId = :loggedInUserId, @AvailabilityId = :availabilityId, ${PARAMS}`,
    { ...slot, loggedInUserId, availabilityId }
  ));
}

function remove(loggedInUserId, availabilityId) {
  return first(runSp(
    "EXEC dbo.sp_DeleteDoctorAvailability @LoggedInUserId = :loggedInUserId, @AvailabilityId = :availabilityId",
    { loggedInUserId, availabilityId }
  ));
}

module.exports = { list, create, update, remove, DAY_ORDER, hhmm };
