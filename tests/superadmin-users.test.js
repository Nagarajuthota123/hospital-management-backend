const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const { comparePassword } = require("../src/utils/password");
const app = require("../src/app");

const superAdmin = `Bearer ${signToken({ sub: 1, roleName: "SuperAdmin" })}`;
const admin = `Bearer ${signToken({ sub: 2, roleName: "Admin" })}`;
const api = (method, path) => request(app)[method](`/api/v1/superadmin/users${path}`).set("Authorization", superAdmin);

describe("/api/v1/superadmin/users", () => {
  let query;
  beforeEach(() => {
    query = jest.spyOn(sequelize, "query").mockResolvedValue([{ StatusCode: 200, UserId: 8, Message: "Done." }]);
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ["put", "/8", { username: "eleanor2", email: "E2@x.com" }, "sp_SuperAdmin_UpdateUser", { loggedInUserId: 1, userId: 8, username: "eleanor2", email: "e2@x.com" }],
    ["patch", "/8/status", { isActive: false }, "sp_SuperAdmin_SetUserActive", { loggedInUserId: 1, userId: 8, isActive: false }],
    ["patch", "/8/lock", { isLocked: true }, "sp_SuperAdmin_SetUserLock", { loggedInUserId: 1, userId: 8, isLocked: true }],
    ["delete", "/8", undefined, "sp_SuperAdmin_DeleteUser", { loggedInUserId: 1, userId: 8 }],
  ])("%s %s calls %s with the token's SuperAdmin id", async (method, path, body, sp, replacements) => {
    const res = await api(method, path).send(body);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Done.");
    expect(query.mock.calls[0][0]).toContain(`EXEC dbo.${sp}`);
    expect(query.mock.calls[0][1].replacements).toEqual(replacements);
  });

  it("lists users with optional role/active filters", async () => {
    query.mockResolvedValue([{ StatusCode: 200, UserId: 8, Username: "eleanor" }]);
    const all = await api("get", "");
    expect(all.body.data).toEqual([{ UserId: 8, Username: "eleanor" }]);
    expect(query.mock.calls[0][1].replacements).toEqual({ loggedInUserId: 1, roleName: null, isActive: null });

    await api("get", "?roleName=Doctor&isActive=false");
    expect(query.mock.calls[1][1].replacements).toEqual({ loggedInUserId: 1, roleName: "Doctor", isActive: false });
    expect((await api("get", "?roleName=Nurse")).status).toBe(422);
  });

  it("gets one user, 404 when the procedure returns nothing", async () => {
    expect((await api("get", "/8")).body.data).toEqual({ UserId: 8, Message: "Done." });
    expect(query.mock.calls[0][0]).toContain("EXEC dbo.sp_SuperAdmin_GetUserById");
    query.mockResolvedValue([]);
    expect((await api("get", "/99")).status).toBe(404);
  });

  it("sends only a bcrypt hash of the new password", async () => {
    await api("patch", "/8/password").send({ newPassword: "NewPass@123" });
    const { passwordHash } = query.mock.calls[0][1].replacements;
    expect(passwordHash).not.toContain("NewPass@123");
    expect(await comparePassword("NewPass@123", passwordHash)).toBe(true);
  });

  it("passes the procedure's errors through", async () => {
    query.mockResolvedValue([{ StatusCode: 409, Message: "Username already exists." }]);
    const res = await api("put", "/8").send({ username: "taken", email: "t@x.com" });
    expect(res.status).toBe(409);
  });

  it("blocks deactivating, locking or deleting your own account", async () => {
    expect((await api("patch", "/1/status").send({ isActive: false })).status).toBe(400);
    expect((await api("patch", "/1/lock").send({ isLocked: true })).status).toBe(400);
    expect((await api("delete", "/1")).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("validates input and rejects non-SuperAdmin tokens before calling the database", async () => {
    expect((await api("patch", "/8/status").send({})).status).toBe(422);
    expect((await api("patch", "/8/password").send({ newPassword: "123" })).status).toBe(422);
    expect((await api("put", "/abc").send({ username: "abc", email: "a@x.com" })).status).toBe(422);
    expect((await request(app).delete("/api/v1/superadmin/users/8").set("Authorization", admin)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
