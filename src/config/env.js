require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,

  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 1433,
    instance: process.env.DB_INSTANCE || "", // e.g. SQLEXPRESS01 for DESKTOP-XXXX\SQLEXPRESS01
    name: required("DB_NAME", "HIMS"),
    user: required("DB_USER", "sa"),
    password: process.env.DB_PASSWORD || "",
    encrypt: process.env.DB_ENCRYPT === "true",
    logging: process.env.DB_LOGGING === "true",
  },

  jwt: {
    secret: required("JWT_SECRET", "dev-only-secret-change-me"),
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,

  // comma-separated list, e.g. CORS_ORIGIN=http://localhost:5173,http://192.168.0.41:5173
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : "*",
};
