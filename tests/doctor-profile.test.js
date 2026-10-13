const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const superAdminToken = `Bearer ${signToken({ sub: 8, roleName: "SuperAdmin" })}`;
const adminToken = `Bearer ${signToken({ sub: 1, roleName: "Admin" })}`;
const raiserror = (message) => Object.assign(new Error(message), { original: { number: 50000, message } });

describe("/api/v1/doctor-profiles", () => {
  let query;
  beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
  afterEach(() => jest.restoreAllMocks());

  it("creates a profile as the signed-in SuperAdmin, passing null for omitted fields", async () => {
    query.mockResolvedValue([{ StatusCode: 200, DoctorId: "7", Message: "Doctor created successfully" }]);
    const res = await request(app).post("/api/v1/doctor-profiles").set("Authorization", superAdminToken)
      .send({ firstName: "John", phone: "9876543210" });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ DoctorId: "7", Message: "Doctor created successfully" });
    expect(query.mock.calls[0][1].replacements).toMatchObject({ loggedInUserId: 8, firstName: "John", userId: null });
  });

  it("gets a profile by id", async () => {
    query.mockResolvedValue([{ DoctorId: "7", Username: "drjohn" }]);
    const res = await request(app).get("/api/v1/doctor-profiles/7").set("Authorization", superAdminToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ DoctorId: "7", Username: "drjohn" });
    expect(query.mock.calls[0][1].replacements).toEqual({ loggedInUserId: 8, doctorId: 7 });
  });

  it("gets a profile by username by resolving its DoctorId from the doctor list", async () => {
    query
      .mockResolvedValueOnce([{ DoctorId: "6", Username: "other" }, { DoctorId: "7", Username: "DrJohn" }])
      .mockResolvedValueOnce([{ DoctorId: "7", Username: "DrJohn" }]);
    const res = await request(app).get("/api/v1/doctor-profiles/drjohn").set("Authorization", superAdminToken);
    expect(res.status).toBe(200);
    expect(query.mock.calls[1][1].replacements).toEqual({ loggedInUserId: 8, doctorId: "7" });
  });

  it("returns 404 for an unknown username", async () => {
    query.mockResolvedValue([{ DoctorId: "6", Username: "other" }]);
    const res = await request(app).delete("/api/v1/doctor-profiles/nobody").set("Authorization", superAdminToken);
    expect(res.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("maps the SP's 'Only SuperAdmin...' error to 403", async () => {
    query.mockRejectedValue(raiserror("Only SuperAdmin can view doctors."));
    const res = await request(app).get("/api/v1/doctor-profiles").set("Authorization", superAdminToken);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Only SuperAdmin can view doctors.");
  });

  it("rejects Admin tokens before calling the database", async () => {
    const res = await request(app).get("/api/v1/doctor-profiles").set("Authorization", adminToken);
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
