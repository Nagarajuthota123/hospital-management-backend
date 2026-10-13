const app = require("./app");
const config = require("./config/env");
const logger = require("./config/logger");
const { connectDB } = require("./config/database");
const { startAutoHashJob } = require("./jobs/autoHashPasswords");

async function start() {
  try {
    await connectDB();
    startAutoHashJob();
    app.listen(config.port, () => logger.info(`CareSphere API listening on port ${config.port} (${config.env})`));
  } catch (err) {
    logger.error("Failed to start server:", err.original?.message || err.message);
    process.exit(1);
  }
}

start();
