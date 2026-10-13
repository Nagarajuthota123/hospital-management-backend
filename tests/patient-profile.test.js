const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const patientToken = `Bearer ${signToken({ sub: 8, roleName: "Patient" })}`;
const adminToken = `Bearer ${signToken({ sub: 1, roleName: "Admin" })}`;
const profile = { firstName: "Eleanor", phone: "9876543210", dateOfBirth: "2000-05-15", bloodGroup: "O+", gender: "Female", address: "Hyderabad", height: 165, weight: 60 };

describe("/api/v1/patient-profile", () => {
  let query;
  beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
  afterEach(() => jest.restoreAllMocks());

  it("creates the signed-in patient's profile, user id from the token", async () => {
    query.mockResolvedValue([{ StatusCode: 201, Message: "Patient profile created successfully." }]);
    const res = await request(app).post("/api/v1/patient-profile").set("Authorization", patientToken).send({ ...profile, userId: 99 });

    expect(res.status).toBe(201);
    expect(query.mock.calls[0][0]).toContain("EXEC dbo.sp_CreatePatientProfile @UserId = :userId, @PatientMRN = :patientMrn");
    expect(query.mock.calls[0][1].replacements).toMatchObject({ userId: 8, patientMrn: "PAT000008", dateOfBirth: "2000-05-15", height: 165, allergies: null });
  });

  it("returns the profile with PatientId, UserId and the SP's message", async () => {
    query.mockResolvedValue([{ StatusCode: 200, PatientId: "2", UserId: "8", PatientMRN: "PAT001", Message: "Patient profile retrieved successfully." }]);
    const res = await request(app).get("/api/v1/patient-profile").set("Authorization", patientToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ PatientId: "2", UserId: "8", PatientMRN: "PAT001" });
    expect(res.body.message).toBe("Patient profile retrieved successfully.");
  });

  it("passes the SP's 404 through", async () => {
    query.mockResolvedValue([{ StatusCode: 404, Message: "Patient profile not found." }]);
    const res = await request(app).put("/api/v1/patient-profile").set("Authorization", patientToken).send(profile);
    expect(res.status).toBe(404);
  });

  it("rejects bad blood group and future birth date before calling the database", async () => {
    const res = await request(app).post("/api/v1/patient-profile").set("Authorization", patientToken)
      .send({ ...profile, bloodGroup: "Z+", dateOfBirth: "2999-01-01" });
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(["bloodGroup", "dateOfBirth"]);
    expect(query).not.toHaveBeenCalled();
  });

  it("requires the fields the procedures require (dateOfBirth, gender, address)", async () => {
    const { dateOfBirth, gender, address, ...rest } = profile;
    const res = await request(app).put("/api/v1/patient-profile").set("Authorization", patientToken).send(rest);
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(["address", "dateOfBirth", "gender"]);
    expect(query).not.toHaveBeenCalled();
  });

  it("rejects non-patient tokens", async () => {
    const res = await request(app).get("/api/v1/patient-profile").set("Authorization", adminToken);
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
