const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const token = (roleName, sub = 1) => `Bearer ${signToken({ sub, roleName })}`;
const raiserror = (message) => Object.assign(new Error(message), { original: { number: 50000, message } });
const slot = { dayOfWeek: "Monday", startTime: "09:00", endTime: "13:00", slotMinutes: 30, consultationFee: 500 };
const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`); // how tedious returns SQL TIME

describe("/api/v1/doctor-availability", () => {
  let query;
  beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
  afterEach(() => jest.restoreAllMocks());

  it("lets any signed-in user view a schedule, Monday-first with HH:mm times", async () => {
    query.mockResolvedValue([
      { AvailabilityId: 2, DayOfWeek: "Tuesday", StartTime: t("09:00"), EndTime: t("12:00") },
      { AvailabilityId: 1, DayOfWeek: "Monday", StartTime: t("14:00"), EndTime: t("18:00") },
      { AvailabilityId: 3, DayOfWeek: "Monday", StartTime: t("09:00"), EndTime: t("13:00") },
    ]);
    const res = await request(app).get("/api/v1/doctor-availability/1").set("Authorization", token("Patient", 8));
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => [r.AvailabilityId, r.StartTime, r.EndTime])).toEqual([[3, "09:00", "13:00"], [1, "14:00", "18:00"], [2, "09:00", "12:00"]]);
    expect(query.mock.calls[0][1].replacements).toEqual({ doctorId: 1 });
  });

  it("creates a slot as SuperAdmin/Admin with the token's user id", async () => {
    query.mockResolvedValue([{ AvailabilityId: "5", Message: "Doctor Availability Created Successfully" }]);
    const res = await request(app).post("/api/v1/doctor-availability").set("Authorization", token("Admin", 2)).send({ ...slot, doctorId: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Doctor Availability Created Successfully");
    expect(query.mock.calls[0][1].replacements).toEqual({ ...slot, doctorId: 1, loggedInUserId: 2 });
  });

  it("updates and deletes by availability id", async () => {
    query.mockResolvedValue([{ Message: "OK" }]);
    expect((await request(app).put("/api/v1/doctor-availability/5").set("Authorization", token("SuperAdmin")).send(slot)).status).toBe(200);
    expect(query.mock.calls[0][1].replacements).toEqual({ ...slot, loggedInUserId: 1, availabilityId: 5 });
    expect((await request(app).delete("/api/v1/doctor-availability/5").set("Authorization", token("SuperAdmin"))).status).toBe(200);
    expect(query.mock.calls[1][1].replacements).toEqual({ loggedInUserId: 1, availabilityId: 5 });
  });

  it.each([
    ["Doctor not found.", 404],
    ["Availability overlaps with existing schedule.", 409],
    ["End Time must be greater than Start Time.", 400],
  ])("maps the procedure's RAISERROR '%s' to %i", async (message, status) => {
    query.mockRejectedValue(raiserror(message));
    const res = await request(app).post("/api/v1/doctor-availability").set("Authorization", token("Admin")).send({ ...slot, doctorId: 1 });
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
  });

  it("blocks patients and doctors from changing schedules, and bad input, before the database", async () => {
    expect((await request(app).post("/api/v1/doctor-availability").set("Authorization", token("Patient")).send({ ...slot, doctorId: 1 })).status).toBe(403);
    expect((await request(app).delete("/api/v1/doctor-availability/5").set("Authorization", token("Doctor"))).status).toBe(403);
    const bad = await request(app).post("/api/v1/doctor-availability").set("Authorization", token("Admin"))
      .send({ doctorId: 1, dayOfWeek: "Funday", startTime: "9am", endTime: "13:00", slotMinutes: 0, consultationFee: -1 });
    expect(bad.status).toBe(422);
    expect(bad.body.errors.map((e) => e.field).sort()).toEqual(["consultationFee", "dayOfWeek", "slotMinutes", "startTime"]);
    expect((await request(app).get("/api/v1/doctor-availability/1")).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});
