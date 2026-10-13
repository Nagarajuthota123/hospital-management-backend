const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const superAdminToken = `Bearer ${signToken({ sub: 8, roleName: "SuperAdmin" })}`;
const adminToken = `Bearer ${signToken({ sub: 1, roleName: "Admin" })}`;

describe("/api/v1/superadmin-profile", () => {
  let query;
  beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
  afterEach(() => jest.restoreAllMocks());

  it("creates the signed-in SuperAdmin's profile with the default designation", async () => {
    query.mockResolvedValue([{ StatusCode: 201, ProfileId: 1, UserId: 8, Message: "SuperAdmin profile created successfully." }]);
    const res = await request(app).post("/api/v1/superadmin-profile").set("Authorization", superAdminToken)
      .send({ firstName: "System", phone: "9999999999", userId: 99 });

    expect(res.status).toBe(201);
    expect(query.mock.calls[0][1].replacements).toMatchObject({ userId: 8, designation: "System Administrator", lastName: null });
  });

  it("passes null designation on update so the SP keeps the current one", async () => {
    query.mockResolvedValue([{ StatusCode: 200, Message: "SuperAdmin profile updated successfully." }]);
    const res = await request(app).put("/api/v1/superadmin-profile").set("Authorization", superAdminToken)
      .send({ firstName: "Super", phone: "9888888888" });

    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1].replacements.designation).toBeNull();
  });

  it("returns the SP's StatusCode and Message on failure", async () => {
    query.mockResolvedValue([{ StatusCode: 404, Message: "SuperAdmin profile not found." }]);
    const res = await request(app).get("/api/v1/superadmin-profile").set("Authorization", superAdminToken);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("SuperAdmin profile not found.");
  });

  it("rejects non-SuperAdmin tokens before calling the database", async () => {
    const res = await request(app).get("/api/v1/superadmin-profile").set("Authorization", adminToken);
    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
