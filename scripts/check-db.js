// Read-only check: does every stored procedure the code calls exist in the database,
// with every @Param the code passes? Run: npm run check:db  (uses .env; changes nothing)
const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../src/config/database");
const { ROLES } = require("../src/modules/accounts/accounts.service");

// Collect "EXEC dbo.<sp> @A = ..., @B = ..." from the source (template ${...} pieces are expanded below).
function callsInSource() {
  const calls = new Map();
  const add = (sp, params) => calls.set(sp, new Set([...(calls.get(sp) || []), ...params]));
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    if (!p.endsWith(".js")) return;
    const src = fs.readFileSync(p, "utf8");
    const consts = Object.fromEntries([...src.matchAll(/const (\w+) = [`"]([^`"]*)[`"]/g)].map((m) => [m[1], m[2]]));
    for (const m of src.matchAll(/EXEC dbo\.(\w+|\$\{[^}]+\})([^`"]*)[`"]/g)) {
      const body = m[2].replace(/\$\{(\w+)\}/g, (_, name) => consts[name] || "");
      const params = [...body.matchAll(/@(\w+)\s*=/g)].map((x) => x[1]);
      if (m[1].startsWith("$")) continue; // dynamic name: handled from ROLES below
      add(m[1], params);
    }
  });
  walk(path.join(__dirname, "../src"));
  for (const { createSp, loginSp, createdBy } of Object.values(ROLES)) {
    add(createSp, ["Username", "Email", "PasswordHash", ...(createdBy ? ["CreatedByUserId"] : [])]);
    if (loginSp) add(loginSp, ["UsernameOrEmail"]);
  }
  add("sp_AdminViewPatientProfile", ["AdminUserId", "PatientId"]);
  add("sp_AdminViewDoctorAvailability", ["AdminUserId", "DoctorId"]);
  return calls;
}

(async () => {
  const rows = await sequelize.query(
    `SELECT p.name AS sp, REPLACE(pr.name, '@', '') AS param
     FROM sys.procedures p LEFT JOIN sys.parameters pr ON pr.object_id = p.object_id`,
    { type: QueryTypes.SELECT }
  );
  const db = new Map();
  rows.forEach(({ sp, param }) => db.set(sp, new Set([...(db.get(sp) || []), ...(param ? [param] : [])])));

  let problems = 0;
  for (const [sp, params] of [...callsInSource()].sort()) {
    if (!db.has(sp)) { problems += 1; console.log(`MISSING  ${sp}  (procedure not in database)`); continue; }
    const missing = [...params].filter((p) => !db.get(sp).has(p));
    if (missing.length) { problems += 1; console.log(`PARAMS   ${sp}  code passes @${missing.join(", @")} - procedure has @${[...db.get(sp)].join(", @") || "(none)"}`); }
    else console.log(`OK       ${sp}`);
  }
  console.log(problems ? `\n${problems} problem(s) found.` : "\nAll procedures match.");
  await sequelize.close();
  process.exit(problems ? 1 : 0);
})().catch((err) => { console.error(err.original?.message || err.message); process.exit(1); });
