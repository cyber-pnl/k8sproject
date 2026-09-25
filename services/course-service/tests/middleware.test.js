const { isAuthenticated, isAdmin } = require("../src/shared/middlewares/auth.middleware");

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("auth middleware", () => {
  describe("isAuthenticated", () => {
    it("accepts x-user-id header and normalizes role to lowercase", () => {
      const req = { headers: { "x-user-id": "7", "x-user-role": "ADMIN" } };
      const res = mockRes();
      const next = jest.fn();

      isAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({ id: "7", role: "admin" });
      expect(res.status).not.toHaveBeenCalled();
    });

    it("uses 'user' as default role", () => {
      const req = { headers: { "x-user-id": "1" } };
      const next = jest.fn();

      isAuthenticated(req, null, next);

      expect(req.user).toEqual({ id: "1", role: "user" });
      expect(next).toHaveBeenCalled();
    });

    it("rejects when no user header", () => {
      const req = { headers: {} };
      const res = mockRes();

      isAuthenticated(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });
  });

  describe("isAdmin", () => {
    it.each(["admin", "ADMIN", "Admin"])("accepts role %s (case-insensitive)", (role) => {
      const req = { headers: { "x-user-role": role } };
      const res = mockRes();
      const next = jest.fn();

      isAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects non-admin", () => {
      const req = { headers: { "x-user-role": "user" } };
      const res = mockRes();

      isAdmin(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("rejects when no role", () => {
      const req = { headers: {} };
      const res = mockRes();

      isAdmin(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});