const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { ApiError } = require("../middleware/error.middleware");

/**
 * Runs a stored procedure and returns its rows (StatusCode column removed).
 * HIMS procedures report failures two ways; both become an ApiError:
 *  - a { StatusCode >= 400, Message } row
 *  - RAISERROR (SQL error 50000), status read from the wording:
 *    "Only ..." -> 403, "... not found" -> 404, "already ..." / "overlaps" -> 409, anything else -> 400
 */
const raiserrorStatus = (message) =>
  /^only /i.test(message) ? 403 : /not found/i.test(message) ? 404 : /already|overlap/i.test(message) ? 409 : 400;

async function runSp(sql, replacements = {}) {
  let rows;
  try {
    rows = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  } catch (err) {
    if (err.original?.number !== 50000) throw err;
    const { message } = err.original;
    throw new ApiError(raiserrorStatus(message), message);
  }

  const first = rows[0] || {};
  const status = Number(first.StatusCode ?? first.status_code);
  if (status >= 400) throw new ApiError(status, first.Message || first.message || "Request failed.");
  return rows.map(({ StatusCode, status_code, ...row }) => row);
}

module.exports = { runSp };
