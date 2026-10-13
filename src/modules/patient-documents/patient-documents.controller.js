const Joi = require("joi");
const service = require("./patient-documents.service");
const { success } = require("../../utils/response");
const { asyncHandler, ApiError } = require("../../middleware/error.middleware");

// multipart/form-data: text fields below + the file in a field named "file".
const addSchema = Joi.object({
  documentName: Joi.string().trim().max(200).required(),
  // allowed values mirror the CHECK constraints on dbo.patient_documents
  documentType: Joi.string().valid("Clinical", "Surgical", "Prescription", "Report").required(),
  documentSource: Joi.string().valid("Present", "Past").default("Present"), // current record or a past one
});
const idParamSchema = Joi.object({ id: Joi.number().integer().positive().required() });

// The procedures return FilePath (a server-side location); clients use /:id/download instead.
const withoutFilePath = ({ FilePath, ...row }) => row;

const add = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'Attach the file in a form-data field named "file".');
  if (!/\.(pdf|jpe?g|png)$/i.test(req.file.originalname)) throw new ApiError(422, "Only .pdf, .jpg, .jpeg or .png files are allowed.");
  const data = withoutFilePath(await service.add(req.user.id, req.body, req.file));
  return success(res, { data, message: data?.Message || "Document uploaded.", status: 201 });
});

const list = asyncHandler(async (req, res) => {
  const data = (await service.list(req.user.id)).map(withoutFilePath);
  return success(res, { data, message: `${data.length} document(s) found.` });
});

// Metadata only; the server-side file path stays internal.
const getOne = asyncHandler(async (req, res) => {
  const data = withoutFilePath(await service.getOne(req.user.id, req.params.id));
  return success(res, { data, message: data.Message });
});

const download = asyncHandler(async (req, res, next) => {
  const { absPath, fileName } = await service.getFile(req.user.id, req.params.id);
  // attachment: the browser saves the file instead of rendering it
  res.download(absPath, fileName, (err) => {
    if (err && !res.headersSent) next(new ApiError(404, "Document file not found on the server."));
  });
});

module.exports = { add, list, getOne, download, schemas: { addSchema, idParamSchema } };
