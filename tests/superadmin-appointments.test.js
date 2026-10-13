const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const superAdmin = `Bearer ${signToken({ sub: 1, roleName: "SuperAdmin" })}`;
const admin = `Bearer ${signToken({ sub: 2, roleName: "Admin" })}`;
const api = (method, path, token = superAdmin) => request(app)[method](`/api/v1/superadmin/appointments${path}`).set("Authorization", token);

describe("/api/v1/superadmin/appointments", () => {
  let query;
  beforeEach(() => {
    query = jest.spyOn(sequelize, "query").mockResolvedValue([{ StatusCode: 200, AppointmentId: 7, Message: "Done." }]);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["post", "", { doctorId: 1, patientId: 2, appointmentDateTime: "2030-01-15T10:30", reason: "Fever" }, 201,
      "sp_SuperAdmin_BookAppointment", { loggedInUserId: 1, doctorId: 1, patientId: 2, appointmentDateTime: "2030-01-15T10:30:00", reason: "Fever" }],
    ["patch", "/7/reschedule", { newAppointmentDateTime: "2030-01-16T11:00" }, 200,
      "sp_RescheduleAppointment", { loggedInUserId: 1, appointmentId: 7, newAppointmentDateTime: "2030-01-16T11:00:00" }],
    ["patch", "/7/status", { status: "Completed" }, 200,
      "sp_UpdateAppointmentStatus", { loggedInUserId: 1, appointmentId: 7, status: "Completed" }],
    ["get", "/7", undefined, 200, "sp_SuperAdmin_GetAppointmentById", { loggedInUserId: 1, appointmentId: 7 }],
  ])("%s %s calls the procedure with the token's SuperAdmin id", async (method, path, body, status, sp, replacements) => {
    const res = await api(method, path).send(body);
    expect(res.status).toBe(status);
    expect(res.body.message).toBe("Done.");
    expect(query.mock.calls[0][0]).toContain(`EXEC dbo.${sp}`);
    expect(query.mock.calls[0][1].replacements).toEqual(replacements);
  });

  it("lists with optional filters, all null by default", async () => {
    await api("get", "");
    expect(query.mock.calls[0][1].replacements).toEqual({ loggedInUserId: 1, fromDate: null, toDate: null, doctorId: null, patientId: null, status: null });
    await api("get", "?fromDate=2030-01-01&toDate=2030-01-31&doctorId=1&patientId=2&status=Scheduled");
    expect(query.mock.calls[1][1].replacements).toEqual({ loggedInUserId: 1, fromDate: "2030-01-01", toDate: "2030-01-31", doctorId: 1, patientId: 2, status: "Scheduled" });
  });

  it("404s an unknown id and passes procedure errors through", async () => {
    query.mockResolvedValue([]);
    expect((await api("get", "/99")).status).toBe(404);
    query.mockResolvedValue([{ StatusCode: 409, Message: "Doctor already has an appointment at this time." }]);
    expect((await api("patch", "/7/reschedule").send({ newAppointmentDateTime: "2030-01-16T11:00" })).status).toBe(409);
  });

  it("validates input and rejects non-SuperAdmin tokens before calling the database", async () => {
    expect((await api("post", "").send({ doctorId: 1, appointmentDateTime: "2030-01-15T10:30" })).status).toBe(422); // no patientId
    expect((await api("patch", "/7/reschedule").send({ newAppointmentDateTime: "16-01-2030" })).status).toBe(422);
    expect((await api("patch", "/7/status").send({})).status).toBe(422);
    expect((await api("get", "?fromDate=2030-02-01&toDate=2030-01-01")).status).toBe(422);
    expect((await api("get", "/abc")).status).toBe(422);
    expect((await api("get", "", admin)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
