const { Router } = require("express");
const multer = require("multer");
const { ApiError } = require("../../middleware/error.middleware");
const controller = require("./patient-documents.controller");
const { requireTokenRole } = require("../../middleware/auth.middleware");
const { validate } = require("../../middleware/validation.middleware");

const { addSchema, idParamSchema } = controller.schemas;
const byId = validate(idParamSchema, { source: "params" });

// One file, field "file", max 5 MB, kept in memory until the service writes it to uploads/.
const parseUpload = (req, res, next) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new ApiError(413, "File is larger than 5 MB."));
    return next(new ApiError(400, `Upload failed: ${err.message}. Send the file in a form-data field named "file".`));
  });
const router = Router();
router.use(requireTokenRole("Patient"));

router.post("/", parseUpload, validate(addSchema), controller.add);
router.get("/", controller.list);
router.get("/:id", byId, controller.getOne);
router.get("/:id/download", byId, controller.download);

module.exports = router;
