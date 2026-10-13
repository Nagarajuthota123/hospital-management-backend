const { sequelize } = require("../config/database");
const { hashPassword } = require("../utils/password");
const logger = require("../config/logger");

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/; // matches an existing bcrypt hash — skip these
const POLL_MS = Number(process.env.AUTO_HASH_INTERVAL_MS) || 10000;

/**
 * DB team inserts plain-text passwords by hand into the real HIMS `users`
 * table (see auth.service.js loginByRole). This finds any password_hash
 * that isn't already bcrypt and hashes it in place, so no plaintext stays
 * in the column for more than one poll interval.
 *
 * ponytail: no locking against two instances racing on the same row —
 * both would just hash the same plaintext and write a valid (if
 * different-salt) bcrypt hash, so it self-corrects either way. Add a
 * row lock only if you actually run multiple server instances.
 */
async function rehashPlaintextPasswords() {
  const [rows] = await sequelize.query("SELECT id, password_hash FROM users");

  for (const row of rows) {
    if (!row.password_hash || BCRYPT_PATTERN.test(row.password_hash)) continue;

    const hash = await hashPassword(row.password_hash);
    await sequelize.query("UPDATE users SET password_hash = :hash WHERE id = :id", {
      replacements: { hash, id: row.id },
    });
    logger.info(`Auto-hashed plain-text password for user id=${row.id}`);
  }
}

function startAutoHashJob() {
  rehashPlaintextPasswords().catch((err) => logger.error("Auto-hash job failed:", err.message));
  setInterval(() => {
    rehashPlaintextPasswords().catch((err) => logger.error("Auto-hash job failed:", err.message));
  }, POLL_MS);
  logger.info(`Auto-hash job started (polling every ${POLL_MS}ms).`);
}

module.exports = { startAutoHashJob, rehashPlaintextPasswords };
