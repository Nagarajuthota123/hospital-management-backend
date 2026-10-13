const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const pharmacist = `Bearer ${signToken({ sub: 12, roleName: "Pharmacist" })}`;
const superAdmin = `Bearer ${signToken({ sub: 1, roleName: "SuperAdmin" })}`;
const profile = { firstName: "Asha", lastName: "Reddy", phone: "9876543210", shiftStartTime: "09:00", shiftEndTime: "17:00" };
const saUpdate = { firstName: "Asha", lastName: "Rao", phone: "9876543210", email: "Asha@Test.com" };

describe("pharmacist profile", () => {
  let query;
  beforeEach(() => {
    query = jest.spyOn(sequelize, "query").mockResolvedValue([{ StatusCode: 200, PharmacistId: 3, Message: "Done." }]);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["post", "/superadmin/pharmacists", superAdmin, { ...profile, userId: 12 }, 201,
      "sp_CreatePharmacistProfile @UserId = :userId, @FirstName = :firstName, @LastName = :lastName, @Phone = :phone, @ShiftStartTime = :shiftStartTime, @ShiftEndTime = :shiftEndTime, @CreatedByUserId = :createdByUserId",
      { ...profile, userId: 12, createdByUserId: 1 }],
    ["get", "/pharmacist-profile", pharmacist, undefined, 200, "sp_GetPharmacistProfile @UserId = :userId", { userId: 12 }],
    ["put", "/superadmin/pharmacists", superAdmin, { ...profile, userId: 12 }, 200,
      "sp_UpdatePharmacistProfile @UserId = :userId, @FirstName = :firstName, @LastName = :lastName, @Phone = :phone, @ShiftStartTime = :shiftStartTime, @ShiftEndTime = :shiftEndTime, @UpdatedByUserId = :updatedByUserId",
      { ...profile, userId: 12, updatedByUserId: 1 }],
    ["get", "/superadmin/pharmacists", superAdmin, undefined, 200, "sp_SuperAdmin_GetPharmacists @LoggedInUserId", { loggedInUserId: 1 }],
    ["get", "/superadmin/pharmacists/3", superAdmin, undefined, 200, "sp_SuperAdmin_GetPharmacistById", { loggedInUserId: 1, pharmacistId: 3 }],
    ["put", "/superadmin/pharmacists/3", superAdmin, saUpdate, 200, "sp_SuperAdmin_UpdatePharmacist",
      { loggedInUserId: 1, pharmacistId: 3, firstName: "Asha", lastName: "Rao", phone: "9876543210", email: "asha@test.com" }],
  ])("%s %s calls the procedure with exactly its parameters", async (method, path, token, body, status, sql, replacements) => {
    const res = await request(app)[method](`/api/v1${path}`).set("Authorization", token).send(body);
    expect(res.status).toBe(status);
    expect(query.mock.calls[0][0].replace(/\s+/g, " ")).toContain(`EXEC dbo.${sql}`);
    expect(query.mock.calls[0][1].replacements).toEqual(replacements);
  });

  it("returns SQL TIME shift columns as HH:mm", async () => {
    query.mockResolvedValue([{ StatusCode: 200, PharmacistId: 3, ShiftStartTime: new Date("1970-01-01T09:00:00Z"), ShiftEndTime: null }]);
    const res = await request(app).get("/api/v1/pharmacist-profile").set("Authorization", pharmacist);
    expect(res.body.data).toEqual({ PharmacistId: 3, ShiftStartTime: "09:00", ShiftEndTime: null });
  });

  it("lastName defaults to null; shift times are required", async () => {
    const put = (body) => request(app).put("/api/v1/superadmin/pharmacists").set("Authorization", superAdmin).send(body);
    await put({ userId: 12, firstName: "Asha", phone: "9876543210", shiftStartTime: "09:00", shiftEndTime: "17:00" });
    expect(query.mock.calls[0][1].replacements).toEqual({ firstName: "Asha", lastName: null, phone: "9876543210", shiftStartTime: "09:00", shiftEndTime: "17:00", userId: 12, updatedByUserId: 1 });
    const res = await put({ userId: 12, firstName: "Asha", phone: "9876543210" });
    expect(res.status).toBe(422);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(["shiftEndTime", "shiftStartTime"]);
  });

  it("404s when the procedure returns nothing, passes SP errors through", async () => {
    query.mockResolvedValue([]);
    expect((await request(app).get("/api/v1/pharmacist-profile").set("Authorization", pharmacist)).status).toBe(404);
    expect((await request(app).get("/api/v1/superadmin/pharmacists/9").set("Authorization", superAdmin)).status).toBe(404);
    query.mockResolvedValue([{ StatusCode: 409, Message: "Profile already exists." }]);
    expect((await request(app).post("/api/v1/superadmin/pharmacists").set("Authorization", superAdmin).send({ ...profile, userId: 12 })).status).toBe(409);
  });

  it("validates input and roles before calling the database", async () => {
    const post = (body) => request(app).post("/api/v1/superadmin/pharmacists").set("Authorization", superAdmin).send({ userId: 12, ...body });
    expect((await post({ phone: "9876543210" })).status).toBe(422); // no firstName
    expect((await request(app).post("/api/v1/superadmin/pharmacists").set("Authorization", superAdmin).send(profile)).status).toBe(422); // no userId
    expect((await request(app).post("/api/v1/pharmacist-profile").set("Authorization", pharmacist).send(profile)).status).toBe(404); // creation moved
    expect((await request(app).put("/api/v1/pharmacist-profile").set("Authorization", pharmacist).send(profile)).status).toBe(404); // update moved
    expect((await post({ ...profile, shiftStartTime: "9am" })).status).toBe(422);
    expect((await post({ ...profile, shiftStartTime: "18:00", shiftEndTime: "09:00" })).status).toBe(422);
    expect((await request(app).put("/api/v1/superadmin/pharmacists/3").set("Authorization", superAdmin).send({ ...saUpdate, email: "bad" })).status).toBe(422);
    expect((await request(app).get("/api/v1/superadmin/pharmacists/abc").set("Authorization", superAdmin)).status).toBe(422);
    expect((await request(app).get("/api/v1/pharmacist-profile").set("Authorization", superAdmin)).status).toBe(403);
    expect((await request(app).get("/api/v1/superadmin/pharmacists").set("Authorization", pharmacist)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
