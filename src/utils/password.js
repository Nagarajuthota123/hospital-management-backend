const bcrypt = require("bcryptjs");
const config = require("../config/env");

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, comparePassword };
