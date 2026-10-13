const { verifyToken } = require("../utils/jwt");
const { failure } = require("../utils/response");

/**
 * Lightweight guard for tokens issued by the stored-procedure logins
 * (/auth/admin-login, /auth/superadmin-login, doctor/pharmacist/patient login).
 * Those tokens carry { sub, roleName }, so this only verifies the signature and
 * the role - no users-table lookup. Sets req.user = { id, roleName }.
 */
function requireTokenRole(...allowedRoles) {
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) {
      return failure(res, { message: "Authentication required. Provide a Bearer token.", status: 401 });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return failure(res, { message: "Invalid or expired token.", status: 401 });
    }

    // tokens issued before the login id fix carry no sub: make the user sign in again
    if (payload.sub === undefined || payload.sub === null) {
      return failure(res, { message: "Invalid token. Please log in again.", status: 401 });
    }

    if (allowedRoles.length && !allowedRoles.includes(payload.roleName)) {
      return failure(res, { message: `Only ${allowedRoles.join(" / ")} users can perform this action.`, status: 403 });
    }

    req.user = { id: payload.sub, roleName: payload.roleName };
    return next();
  };
}

module.exports = { requireTokenRole };
