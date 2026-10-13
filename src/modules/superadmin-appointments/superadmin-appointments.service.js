const { runSp } = require("../../utils/sp");
const { ApiError } = require("../../middleware/error.middleware");

// The DB team's appointment procedures. @LoggedInUserId is the signed-in SuperAdmin; the procedures do their own role check.
const first = async (promise) => (await promise)[0];

// Every filter is optional: null = no filter.
function list(loggedInUserId, { fromDate = null, toDate = null, doctorId = null, patientId = null, status = null }) {
  return runSp(
    `EXEC dbo.sp_SuperAdmin_GetAppointments @LoggedInUserId = :loggedInUserId, @FromDate = :fromDate, @ToDate = :toDate,
      @DoctorId = :doctorId, @PatientId = :patientId, @Status = :status`,
    { loggedInUserId, fromDate, toDate, doctorId, patientId, status }
  );
}

async function getOne(loggedInUserId, appointmentId) {
  const row = await first(runSp(
    "EXEC dbo.sp_SuperAdmin_GetAppointmentById @LoggedInUserId = :loggedInUserId, @AppointmentId = :appointmentId",
    { loggedInUserId, appointmentId }
  ));
  if (!row) throw new ApiError(404, "Appointment not found.");
  return row;
}

function book(loggedInUserId, { doctorId, patientId, appointmentDateTime, reason }) {
  return first(runSp(
    `EXEC dbo.sp_SuperAdmin_BookAppointment @LoggedInUserId = :loggedInUserId, @DoctorId = :doctorId, @PatientId = :patientId,
      @AppointmentDateTime = :appointmentDateTime, @Reason = :reason`,
    { loggedInUserId, doctorId, patientId, appointmentDateTime, reason }
  ));
}

function reschedule(loggedInUserId, appointmentId, newAppointmentDateTime) {
  return first(runSp(
    `EXEC dbo.sp_RescheduleAppointment @LoggedInUserId = :loggedInUserId, @AppointmentId = :appointmentId,
      @NewAppointmentDateTime = :newAppointmentDateTime`,
    { loggedInUserId, appointmentId, newAppointmentDateTime }
  ));
}

function setStatus(loggedInUserId, appointmentId, status) {
  return first(runSp(
    "EXEC dbo.sp_UpdateAppointmentStatus @LoggedInUserId = :loggedInUserId, @AppointmentId = :appointmentId, @Status = :status",
    { loggedInUserId, appointmentId, status }
  ));
}

module.exports = { list, getOne, book, reschedule, setStatus };
