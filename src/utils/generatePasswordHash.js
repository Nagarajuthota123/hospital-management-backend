/**
 * One-off CLI helper for the DB team: turns a plain-text password into the
 * bcrypt hash to paste into `users.password_hash` when inserting/resetting
 * an account by hand (e.g. superadmin) directly in the DB.
 *
 * Usage: node src/utils/generatePasswordHash.js "NewPassword123"
 */
const { hashPassword } = require("./password");

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: node src/utils/generatePasswordHash.js <plain-text-password>");
  process.exit(1);
}

hashPassword(plain).then((hash) => {
  console.log(hash);
});
