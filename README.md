# CareSphere HIMS — Backend API

Node.js + Express REST API over the shared **HIMS** SQL Server database.
All data access goes through the database's stored procedures; the backend never
creates, alters or drops tables.

## Setup

```bash
cp .env.example .env     # fill in DB_HOST / DB_INSTANCE / DB_USER / DB_PASSWORD / JWT_SECRET
npm install
npm run check:db         # confirms every stored procedure the code calls exists, with the right parameters
npm run dev              # http://localhost:5000/api/v1
npm test                 # Jest tests (database mocked)
```

Named SQL Server instance (e.g. `DESKTOP-09JSEFU\SQLEXPRESS01`): set `DB_HOST` to the machine's IP
and `DB_INSTANCE=SQLEXPRESS01`. The SQL Server Browser service must be running on that machine.

`sql/admin_profile.sql` holds the admin procedures this backend owns (run once in SSMS; safe to re-run).
`npm run hash-password -- "Secret123"` prints a bcrypt hash for inserting an account by hand.

## Responses

```json
{ "success": true,  "message": "OK", "data": ... }
{ "success": false, "message": "Reason" }
```
Send `Authorization: Bearer <token>` on every route except logins, patient register and `/health`.
`:key` in a URL is a **numeric id or a username** — `/admin-profile/patients/2` and `/admin-profile/patients/eleanor` both work (a username is matched in the procedure's list, so it needs the procedure to return a `Username` column).

## Endpoints (`/api/v1`)

| Method | Path | Token | Stored procedure |
|---|---|---|---|
| POST | `/auth/superadmin-login` | — | users / user_roles / roles |
| POST | `/auth/admin-login` | — | users / user_roles / roles |
| POST | `/patient-auth/register` | — | sp_CreatePatientAccount |
| POST | `/patient-auth/login` | — | sp_GetPatientForLogin |
| POST | `/doctor-auth/register` | SuperAdmin | sp_CreateDoctorAccount |
| POST | `/doctor-auth/login` | — | sp_GetDoctorForLogin |
| POST | `/pharmacist-auth/register` | SuperAdmin | sp_CreatePharmacistAccount |
| POST | `/pharmacist-auth/login` | — | sp_GetPharmacistForLogin |
| POST | `/admin-auth/register` | SuperAdmin | sp_CreateAdminAccount |
| POST / GET / PUT | `/superadmin-profile` | SuperAdmin | sp_Create / Get / UpdateSuperAdminProfile |
| GET | `/superadmin/users[?roleName=Doctor&isActive=true]` | SuperAdmin | sp_SuperAdmin_GetUsers |
| GET | `/superadmin/users/:id` | SuperAdmin | sp_SuperAdmin_GetUserById |
| PUT | `/superadmin/users/:id` | SuperAdmin | sp_SuperAdmin_UpdateUser |
| PATCH | `/superadmin/users/:id/status` | SuperAdmin | sp_SuperAdmin_SetUserActive |
| PATCH | `/superadmin/users/:id/lock` | SuperAdmin | sp_SuperAdmin_SetUserLock |
| PATCH | `/superadmin/users/:id/password` | SuperAdmin | sp_SuperAdmin_ResetPassword |
| DELETE | `/superadmin/users/:id` | SuperAdmin | sp_SuperAdmin_DeleteUser |
| POST | `/admin-profile` | Admin | sp_CreateAdminProfile |
| GET | `/admin-profile/patients[/:key]` | Admin, SuperAdmin | sp_AdminViewPatientProfile |
| GET | `/admin-profile/doctors[/:key]` | Admin, SuperAdmin | sp_AdminViewDoctorAvailability |
| GET | `/doctor-profiles` | SuperAdmin | sp_Doctor_GetAllDoctors |
| GET / PUT / DELETE | `/doctor-profiles/:key` | SuperAdmin | sp_Doctor_GetProfile / UpdateProfile / DeleteProfile |
| POST | `/doctor-profiles` | SuperAdmin | sp_Doctor_CreateProfile |
| GET | `/doctor-availability/:doctorId` | any signed-in user | sp_GetDoctorAvailability |
| POST | `/doctor-availability` | SuperAdmin, Admin | sp_CreateDoctorAvailability |
| PUT / DELETE | `/doctor-availability/:id` | SuperAdmin, Admin | sp_Update / DeleteDoctorAvailability |
| POST / GET / PUT | `/patient-profile` | Patient | sp_Create / Get / UpdatePatientProfile |
| GET | `/pharmacist-profile` | Pharmacist | sp_GetPharmacistProfile |
| GET | `/superadmin/pharmacists` | SuperAdmin | sp_SuperAdmin_GetPharmacists |
| POST / PUT | `/superadmin/pharmacists` | SuperAdmin | sp_CreatePharmacistProfile / sp_UpdatePharmacistProfile (body userId = pharmacist account) |
| GET / PUT | `/superadmin/pharmacists/:id` | SuperAdmin | sp_SuperAdmin_GetPharmacistById / UpdatePharmacist |
| GET | `/superadmin/appointments[?fromDate=&toDate=&doctorId=&patientId=&status=]` | SuperAdmin | sp_SuperAdmin_GetAppointments |
| GET | `/superadmin/appointments/:id` | SuperAdmin | sp_SuperAdmin_GetAppointmentById |
| POST | `/superadmin/appointments` | SuperAdmin | sp_SuperAdmin_BookAppointment |
| PATCH | `/superadmin/appointments/:id/reschedule` | SuperAdmin | sp_RescheduleAppointment |
| PATCH | `/superadmin/appointments/:id/status` | SuperAdmin | sp_UpdateAppointmentStatus |
| POST | `/patient-appointments` | Patient | sp_BookAppointment |
| GET | `/patient-appointments` | Patient | sp_GetPatientAppointments |
| PATCH | `/patient-appointments/:id/cancel` | Patient | sp_CancelAppointment |
| POST | `/patient-documents` | Patient | sp_AddPatientDocument (form-data: documentName, documentType = Clinical/Surgical/Prescription/Report, documentSource = Present/Past, file; saved under `uploads/`) |
| GET | `/patient-documents` | Patient | sp_GetPatientDocuments |
| GET | `/patient-documents/:id` and `/:id/download` | Patient | sp_GetPatientDocumentById |
| GET | `/health` | — | — |

`CareSphere.postman_collection.json` has every request with example bodies; the login requests save their tokens automatically.

## Layout

```
src/
  app.js, server.js
  config/        env, logger, database (connection pool only)
  middleware/    requireTokenRole, Joi validation, errors
  utils/sp.js    runSp(): runs a stored procedure, turns StatusCode>=400 / RAISERROR into HTTP errors
  utils/lookup.js  id-or-username :key parsing
  modules/       auth, accounts, superadmin-profile, admin-profile, doctor-profiles, patient-profile, pharmacist-profile, superadmin-appointments,
                 patient-appointments, patient-documents, superadmin-users, doctor-availability
  jobs/          autoHashPasswords (bcrypt-hashes plain-text users.password_hash values)
scripts/check-db.js
sql/admin_profile.sql
```
