const { runSp } = require("../../utils/sp");

// The HIMS procedures, used as they are, keyed by the signed-in patient's user id:
//   sp_BookAppointment @UserId, @DoctorId, @AppointmentDateTime, @Reason
//   sp_GetPatientAppointments @UserId
//   sp_CancelAppointment @UserId, @AppointmentId
const first = async (promise) => (await promise)[0];

function book(userId, { doctorId, appointmentDateTime, reason }) {
  return first(runSp(
    "EXEC dbo.sp_BookAppointment @UserId = :userId, @DoctorId = :doctorId, @AppointmentDateTime = :appointmentDateTime, @Reason = :reason",
    { userId, doctorId, appointmentDateTime, reason }
  ));
}

function list(userId) {
  return runSp("EXEC dbo.sp_GetPatientAppointments @UserId = :userId", { userId });
}

function cancel(userId, appointmentId) {
  return first(runSp("EXEC dbo.sp_CancelAppointment @UserId = :userId, @AppointmentId = :appointmentId", { userId, appointmentId }));
}

module.exports = { book, list, cancel };
