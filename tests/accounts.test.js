const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken, verifyToken } = require("../src/utils/jwt");
const { hashPassword } = require("../src/utils/password");
const app = require("../src/app");

const superAdminToken = `Bearer ${signToken({ sub: 8, roleName: "SuperAdmin" })}`;

describe("account register/login", () => {
  let query;
  beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
  afterEach(() => jest.restoreAllMocks());

  it("lets anyone register a patient, without @CreatedByUserId", async () => {
    query.mockResolvedValue([{ StatusCode: 201, UserId: "8", Message: "Patient account created." }]);
    const res = await request(app).post("/api/v1/patient-auth/register")
      .send({ username: "eleanor", email: "Eleanor@Gmail.com", password: "Patient@123" });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ UserId: "8", Message: "Patient account created." });
    expect(query.mock.calls[0][0]).toBe("EXEC dbo.sp_CreatePatientAccount @Username = :username, @Email = :email, @PasswordHash = :passwordHash");
    expect(query.mock.calls[0][1].replacements.email).toBe("eleanor@gmail.com");
  });

  it("requires a SuperAdmin token to create a pharmacist, passing the creator's id", async () => {
    expect((await request(app).post("/api/v1/pharmacist-auth/register").send({ username: "pharm1", email: "p@x.com", password: "Pharm@123" })).status).toBe(401);

    query.mockResolvedValue([{ StatusCode: 201, Message: "Pharmacist account created." }]);
    const res = await request(app).post("/api/v1/pharmacist-auth/register").set("Authorization", superAdminToken)
      .send({ username: "pharm1", email: "p@x.com", password: "Pharm@123" });
    expect(res.status).toBe(201);
    expect(query.mock.calls[0][1].replacements.createdByUserId).toBe(8);
  });

  it("logs a doctor in with a token for their user id and never returns the hash", async () => {
    const PasswordHash = await hashPassword("Doctor@123");
    query.mockResolvedValue([{ UserId: "5", Username: "drjohn", IsActive: true, PasswordHash }]);
    const res = await request(app).post("/api/v1/doctor-auth/login").send({ usernameOrEmail: "drjohn", password: "Doctor@123" });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ UserId: "5", Username: "drjohn", IsActive: true });
    expect(verifyToken(res.body.data.token)).toMatchObject({ sub: "5", roleName: "Doctor" });
  });

  it("rejects a wrong password with 401", async () => {
    query.mockResolvedValue([{ UserId: "5", IsActive: true, PasswordHash: await hashPassword("right-one") }]);
    const res = await request(app).post("/api/v1/patient-auth/login").send({ usernameOrEmail: "eleanor", password: "wrong-one" });
    expect(res.status).toBe(401);
  });

  it("finds the user id whatever its case (UserID), and refuses a login row with no id", async () => {
    const PasswordHash = await hashPassword("Patient@123");
    query.mockResolvedValue([{ UserID: 8, IsActive: 1, PasswordHash }]);
    const ok = await request(app).post("/api/v1/patient-auth/login").send({ usernameOrEmail: "eleanor", password: "Patient@123" });
    expect(verifyToken(ok.body.data.token).sub).toBe(8);

    // the real sp_GetPatientForLogin shape: no id column, so the id is looked up by username
    query.mockResolvedValueOnce([{ Username: "eleanor", Email: "e@x.com", PasswordHash, RoleName: "Patient", Message: "OK" }])
      .mockResolvedValueOnce([{ id: 8 }]);
    const looked = await request(app).post("/api/v1/patient-auth/login").send({ usernameOrEmail: "eleanor", password: "Patient@123" });
    expect(looked.status).toBe(200);
    expect(verifyToken(looked.body.data.token).sub).toBe(8);
    expect(query.mock.calls.at(-1)[1].replacements).toEqual({ username: "eleanor" });

    query.mockReset();
    query.mockResolvedValue([{ PatientId: 2, IsActive: 1, PasswordHash }]);
    const bad = await request(app).post("/api/v1/patient-auth/login").send({ usernameOrEmail: "eleanor", password: "Patient@123" });
    expect(bad.status).toBe(500);
    expect(bad.body.message).toContain("no user id column (got: PatientId, IsActive, PasswordHash)");
  });

  it("rejects an old token that has no user id", async () => {
    const res = await request(app).get("/api/v1/patient-appointments").set("Authorization", `Bearer ${signToken({ roleName: "Patient" })}`);
    expect(res.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});
