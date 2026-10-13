const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const adminToken = `Bearer ${signToken({ sub: 1, roleName: "Admin" })}`;
const superAdminToken = `Bearer ${signToken({ sub: 8, roleName: "SuperAdmin" })}`;
const doctorToken = `Bearer ${signToken({ sub: 3, roleName: "Doctor" })}`;

describe("/api/v1/admin-profile", () => {
  let query;
  beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
  afterEach(() => jest.restoreAllMocks());

  it("creates the signed-in Admin's profile, user id from the token", async () => {
    query.mockResolvedValue([{ StatusCode: 201, ProfileId: "4", UserId: "1", Message: "Admin profile created successfully." }]);
    const res = await request(app).post("/api/v1/admin-profile").set("Authorization", adminToken)
      .send({ firstName: "Asha", phone: "9876543210", userId: 99 });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ ProfileId: "4", UserId: "1", Message: "Admin profile created successfully." });
    expect(query.mock.calls[0][1].replacements).toMatchObject({ userId: 1, designation: null, department: null });
  });

  it("returns the SP's 409 when the profile already exists", async () => {
    query.mockResolvedValue([{ StatusCode: 409, Message: "Admin profile already exists." }]);
    const res = await request(app).post("/api/v1/admin-profile").set("Authorization", adminToken)
      .send({ firstName: "Asha", phone: "9876543210" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Admin profile already exists.");
  });

  it("lists patients with id and username", async () => {
    query.mockResolvedValue([{ StatusCode: 200, PatientId: "2", UserId: "8", Username: "eleanor" }]);
    const res = await request(app).get("/api/v1/admin-profile/patients").set("Authorization", superAdminToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ PatientId: "2", UserId: "8", Username: "eleanor" }]);
    expect(query.mock.calls[0][1].replacements).toEqual({ adminUserId: 8, id: null });
  });

  it.each([
    ["patients/2", "sp_AdminViewPatientProfile", "@PatientId", { id: 2 }],
    ["doctors/5", "sp_AdminViewDoctorAvailability", "@DoctorId", { id: 5 }],
  ])("GET /%s looks up by id", async (path, sp, idParam, lookup) => {
    query.mockResolvedValue([{ StatusCode: 200, Username: "x" }]);
    const res = await request(app).get(`/api/v1/admin-profile/${path}`).set("Authorization", adminToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ Username: "x" });
    expect(query.mock.calls[0][0]).toBe(`EXEC dbo.${sp} @AdminUserId = :adminUserId, ${idParam} = :id`);
    expect(query.mock.calls[0][1].replacements).toEqual({ adminUserId: 1, ...lookup });
  });

  it("finds a patient by username in the full list (the SP has no @Username)", async () => {
    query.mockResolvedValue([{ StatusCode: 200, PatientId: 1, Username: "ravi" }, { StatusCode: 200, PatientId: 2, Username: "Eleanor" }]);
    const res = await request(app).get("/api/v1/admin-profile/patients/eleanor").set("Authorization", adminToken);
    expect(res.body.data).toEqual({ PatientId: 2, Username: "Eleanor" });
    expect(query.mock.calls[0][1].replacements).toEqual({ adminUserId: 1, id: null });
  });

  it("says so when the SP returns no Username to match on", async () => {
    query.mockResolvedValue([{ StatusCode: 200, DoctorId: 1, DoctorName: "John" }]);
    const res = await request(app).get("/api/v1/admin-profile/doctors/drjohn").set("Authorization", adminToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Use the id/);
  });

  it("returns 404 for an unknown record", async () => {
    query.mockResolvedValue([]);
    const res = await request(app).get("/api/v1/admin-profile/doctors/nobody").set("Authorization", adminToken);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Doctor not found.");
  });

  it("rejects a too-short key and other roles before calling the database", async () => {
    expect((await request(app).get("/api/v1/admin-profile/patients/ab").set("Authorization", adminToken)).status).toBe(422);
    expect((await request(app).get("/api/v1/admin-profile/patients").set("Authorization", doctorToken)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
