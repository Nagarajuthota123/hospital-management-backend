const { runSp } = require("../../utils/sp");
const { ApiError } = require("../../middleware/error.middleware");

async function create(userId, profile) {
  const [row] = await runSp(
    `EXEC dbo.sp_CreateAdminProfile @UserId = :userId, @FirstName = :firstName, @LastName = :lastName,
      @Phone = :phone, @Email = :email, @Designation = :designation, @Department = :department`,
    { ...profile, userId }
  );
  return row;
}

// Each view SP takes an optional id: null = list all, set = that record.
const VIEWS = {
  patient: { sp: "sp_AdminViewPatientProfile", idParam: "PatientId", label: "Patient" },
  doctor: { sp: "sp_AdminViewDoctorAvailability", idParam: "DoctorId", label: "Doctor" },
};

function list(kind, adminUserId, id = null) {
  const { sp, idParam } = VIEWS[kind];
  return runSp(`EXEC dbo.${sp} @AdminUserId = :adminUserId, @${idParam} = :id`, { adminUserId, id });
}

const usernameOf = (row) => Object.entries(row).find(([k]) => k.toLowerCase() === "username")?.[1];

async function getOne(kind, adminUserId, { id, username }) {
  const view = VIEWS[kind];
  let row;
  if (id) [row] = await list(kind, adminUserId, id);
  else {
    // The DB team's view SPs have no @Username, so match it against the full list.
    // ponytail: O(n) scan; ask the DB team for an @Username param if these lists get large.
    const rows = await list(kind, adminUserId);
    if (rows.length && usernameOf(rows[0]) === undefined) {
      throw new ApiError(400, `${view.label} lookup by username isn't supported (${view.sp} returns no Username). Use the id.`);
    }
    row = rows.find((r) => String(usernameOf(r)).toLowerCase() === username.toLowerCase());
  }
  if (!row) throw new ApiError(404, `${view.label} not found.`);
  return row;
}

module.exports = { create, list, getOne };
