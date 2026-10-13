const request = require("supertest");
const app = require("../src/app");

describe("GET /api/v1/health", () => {
  it("returns a healthy status without requiring authentication", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Protected routes", () => {
  it("rejects requests with no auth token", async () => {
    const res = await request(app).get("/api/v1/admin-profile/patients");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
