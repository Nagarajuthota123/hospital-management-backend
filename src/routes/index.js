const { Router } = require("express");
const { buildAccountRouter } = require("../modules/accounts/accounts.routes");

const router = Router();

// Logins backed by the users/user_roles/roles tables
router.use("/auth", require("../modules/auth/auth.routes"));

// Account register/login (sp_Create*Account / sp_Get*ForLogin)
router.use("/patient-auth", buildAccountRouter("Patient"));
router.use("/doctor-auth", buildAccountRouter("Doctor"));
router.use("/pharmacist-auth", buildAccountRouter("Pharmacist"));
router.use("/admin-auth", buildAccountRouter("Admin"));

// Profiles
router.use("/superadmin-profile", require("../modules/superadmin-profile/superadmin-profile.routes"));
router.use("/superadmin/users", require("../modules/superadmin-users/superadmin-users.routes"));
router.use("/admin-profile", require("../modules/admin-profile/admin-profile.routes"));
router.use("/doctor-profiles", require("../modules/doctor-profiles/doctor-profile.routes"));
router.use("/doctor-availability", require("../modules/doctor-availability/doctor-availability.routes"));
router.use("/patient-profile", require("../modules/patient-profile/patient-profile.routes"));

const pharmacist = require("../modules/pharmacist-profile/pharmacist-profile.routes");
router.use("/pharmacist-profile", pharmacist.selfRouter);
router.use("/superadmin/pharmacists", pharmacist.superAdminRouter);
router.use("/superadmin/appointments", require("../modules/superadmin-appointments/superadmin-appointments.routes"));

// Patient's own appointments and documents
router.use("/patient-appointments", require("../modules/patient-appointments/patient-appointments.routes"));
router.use("/patient-documents", require("../modules/patient-documents/patient-documents.routes"));

router.get("/health", (req, res) => res.json({ success: true, message: "CareSphere API is healthy." }));

module.exports = router;
