const fs = require("fs");
const request = require("supertest");
const { sequelize } = require("../src/config/database");
const { signToken } = require("../src/utils/jwt");
const app = require("../src/app");

const patientToken = `Bearer ${signToken({ sub: 8, roleName: "Patient" })}`;
const doctorToken = `Bearer ${signToken({ sub: 3, roleName: "Doctor" })}`;

let query;
beforeEach(() => { query = jest.spyOn(sequelize, "query"); });
afterEach(() => jest.restoreAllMocks());

describe("/api/v1/patient-appointments", () => {
  const booking = { doctorId: 1, appointmentDateTime: "2030-01-15T10:30", reason: "Fever" };

  it("books for the token's patient, ignoring any userId in the body", async () => {
    query.mockResolvedValue([{ StatusCode: 201, AppointmentId: "7", Message: "Appointment booked successfully." }]);
    const res = await request(app).post("/api/v1/patient-appointments").set("Authorization", patientToken).send({ ...booking, userId: 99 });
    expect(res.status).toBe(201);
    expect(res.body.data.AppointmentId).toBe("7");
    expect(query.mock.calls[0][0]).toContain("EXEC dbo.sp_BookAppointment @UserId = :userId");
    expect(query.mock.calls[0][1].replacements).toEqual({ userId: 8, doctorId: 1, appointmentDateTime: "2030-01-15T10:30:00", reason: "Fever" });
  });

  it("passes the SP's 409 (slot taken) through", async () => {
    query.mockResolvedValue([{ StatusCode: 409, Message: "This time slot is already booked. Please choose another." }]);
    const res = await request(app).post("/api/v1/patient-appointments").set("Authorization", patientToken).send(booking);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already booked/);
  });

  it("rejects a malformed date-time before calling the database", async () => {
    const res = await request(app).post("/api/v1/patient-appointments").set("Authorization", patientToken).send({ ...booking, appointmentDateTime: "15-01-2030 10:30" });
    expect(res.status).toBe(422);
    expect(query).not.toHaveBeenCalled();
  });

  it("lists the patient's appointments, empty list is 200", async () => {
    query.mockResolvedValue([]);
    const res = await request(app).get("/api/v1/patient-appointments").set("Authorization", patientToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(query.mock.calls[0][1].replacements).toEqual({ userId: 8 });
  });

  it("cancels by id", async () => {
    query.mockResolvedValue([{ StatusCode: 200, AppointmentId: 7, Status: "Cancelled", Message: "Appointment cancelled successfully." }]);
    const res = await request(app).patch("/api/v1/patient-appointments/7/cancel").set("Authorization", patientToken).send();
    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1].replacements).toEqual({ userId: 8, appointmentId: 7 });
  });

  it("rejects non-patient tokens", async () => {
    const res = await request(app).get("/api/v1/patient-appointments").set("Authorization", doctorToken);
    expect(res.status).toBe(403);
  });
});

describe("/api/v1/patient-documents", () => {
  const pdf = Buffer.from("%PDF-1.4 test");
  const upload = (fileName = "cbc report.pdf", content = pdf) => request(app).post("/api/v1/patient-documents").set("Authorization", patientToken)
    .field("documentName", "CBC report").field("documentType", "Report").attach("file", content, fileName);

  it("saves the file, stores its path via the SP, and the download returns the same bytes", async () => {
    query.mockResolvedValueOnce([{ StatusCode: 201, DocumentId: "4", Message: "Document uploaded successfully." }]);
    const res = await upload();
    expect(res.status).toBe(201);

    const { filePath, fileName, fileType, documentSource, documentName } = query.mock.calls[0][1].replacements;
    expect(query.mock.calls[0][0]).toContain("@DocumentName = :documentName, @DocumentSource = :documentSource");
    expect({ fileName, fileType, documentSource, documentName }).toEqual({ fileName: "cbc_report.pdf", fileType: "application/pdf", documentSource: "Present", documentName: "CBC report" });
    expect(filePath).toMatch(/^patients\/8\/\d+-\w+-cbc_report\.pdf$/);

    query.mockResolvedValueOnce([{ StatusCode: 200, DocumentId: "4", FileName: fileName, FilePath: filePath }]);
    const dl = await request(app).get("/api/v1/patient-documents/4/download").set("Authorization", patientToken).buffer();
    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).toContain("attachment");
    expect(Buffer.from(dl.body).equals(pdf)).toBe(true);

    fs.rmSync(require("path").resolve(__dirname, "../uploads", filePath));
  });

  it("deletes the saved file when the SP refuses the upload", async () => {
    query.mockResolvedValue([{ StatusCode: 404, Message: "Patient profile not found. Create your profile first." }]);
    const res = await upload();
    expect(res.status).toBe(404);
    expect(fs.existsSync(require("path").resolve(__dirname, "../uploads", query.mock.calls[0][1].replacements.filePath))).toBe(false);
  });

  it("rejects a disallowed type, a missing file and an oversized file before touching disk or database", async () => {
    expect((await upload("evil.html")).status).toBe(422);
    const noFile = await request(app).post("/api/v1/patient-documents").set("Authorization", patientToken)
      .field("documentName", "x").field("documentType", "Report");
    expect(noFile.status).toBe(422);
    expect(noFile.body.message).toMatch(/field named "file"/);
    expect((await upload("big.pdf", Buffer.alloc(5 * 1024 * 1024 + 1))).status).toBe(413);
    const badType = await request(app).post("/api/v1/patient-documents").set("Authorization", patientToken)
      .field("documentName", "x").field("documentType", "Lab Report").attach("file", pdf, "a.pdf");
    expect(badType.status).toBe(422);
    expect(badType.body.errors[0].message).toContain("Clinical, Surgical, Prescription, Report");
    expect(query).not.toHaveBeenCalled();
  });

  it("hides the server file path in the list", async () => {
    query.mockResolvedValue([{ StatusCode: 200, DocumentId: "4", FileName: "a.pdf", FilePath: "patients/8/a.pdf" }]);
    const res = await request(app).get("/api/v1/patient-documents").set("Authorization", patientToken);
    expect(res.body.data).toEqual([{ DocumentId: "4", FileName: "a.pdf" }]);
  });

  it("hides the server file path in metadata, 404s someone else's document", async () => {
    query.mockResolvedValueOnce([{ StatusCode: 200, DocumentId: "4", FileName: "a.pdf", FilePath: "patients/8/a.pdf" }]);
    const res = await request(app).get("/api/v1/patient-documents/4").set("Authorization", patientToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ DocumentId: "4", FileName: "a.pdf" });

    query.mockResolvedValueOnce([{ StatusCode: 404, Message: "Document not found." }]);
    expect((await request(app).get("/api/v1/patient-documents/99").set("Authorization", patientToken)).status).toBe(404);
  });

  it("refuses a stored path that escapes the uploads folder", async () => {
    query.mockResolvedValue([{ StatusCode: 200, DocumentId: "4", FileName: "x", FilePath: "../.env" }]);
    const res = await request(app).get("/api/v1/patient-documents/4/download").set("Authorization", patientToken);
    expect(res.status).toBe(404);
  });
});
