const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { runSp } = require("../../utils/sp");
const { ApiError } = require("../../middleware/error.middleware");

// The HIMS procedures, used as they are:
//   sp_AddPatientDocument @UserId, @DocumentName, @DocumentSource, @DocumentType, @FileName, @FilePath, @FileType
//   sp_GetPatientDocuments @UserId     sp_GetPatientDocumentById @UserId, @DocumentId
// Files live on disk under <project>/uploads (gitignored); the database stores only the relative path.
// ponytail: local disk, single server. Move to blob storage (S3/Azure) if the API runs on more than one machine.
const UPLOAD_ROOT = path.resolve(__dirname, "../../../uploads");
const MIME_BY_EXT = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" }; // stored as @FileType

const first = async (promise) => (await promise)[0];

// file = multer's in-memory upload ({ originalname, buffer }); the 5 MB cap is enforced in the routes.
async function add(userId, { documentName, documentType, documentSource }, { originalname, buffer }) {
  const safeName = path.basename(originalname).replace(/[^\w.-]/g, "_");
  const relPath = path.posix.join("patients", String(userId), `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`);
  const absPath = path.join(UPLOAD_ROOT, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer);

  try {
    return await first(runSp(
      "EXEC dbo.sp_AddPatientDocument @UserId = :userId, @DocumentName = :documentName, @DocumentSource = :documentSource, @DocumentType = :documentType, @FileName = :fileName, @FilePath = :filePath, @FileType = :fileType",
      { userId, documentName, documentSource, documentType, fileName: safeName, filePath: relPath, fileType: MIME_BY_EXT[path.extname(safeName).slice(1).toLowerCase()] }
    ));
  } catch (err) {
    await fs.rm(absPath, { force: true }); // the database refused it: don't leave an orphan file
    throw err;
  }
}

function list(userId) {
  return runSp("EXEC dbo.sp_GetPatientDocuments @UserId = :userId", { userId });
}

async function getOne(userId, documentId) {
  const doc = await first(runSp("EXEC dbo.sp_GetPatientDocumentById @UserId = :userId, @DocumentId = :documentId", { userId, documentId }));
  if (!doc) throw new ApiError(404, "Document not found.");
  return doc;
}

// Absolute path of the stored file. Refuses anything that resolves outside UPLOAD_ROOT.
async function getFile(userId, documentId) {
  const { FilePath, FileName } = await getOne(userId, documentId);
  const absPath = path.resolve(UPLOAD_ROOT, FilePath || "");
  if (!absPath.startsWith(UPLOAD_ROOT + path.sep)) throw new ApiError(404, "Document file not found.");
  return { absPath, fileName: FileName };
}

module.exports = { add, list, getOne, getFile };
